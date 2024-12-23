import {createServer} from 'node:https';
import OpenAI from "openai";
import * as dotenv from "dotenv";
import {SocksProxyAgent} from "socks-proxy-agent";
import {Server} from "socket.io";
import * as fs from "node:fs";
import {Run} from "openai/resources/beta/threads";
import ApiClient from "./services/ApiClient";

dotenv.config();

// Загрузка сертификатов
const options = {
    key : fs.readFileSync(process.env.SSL_KEY),
    cert: fs.readFileSync(process.env.SSL_CERT)
};

const server = createServer(options);
const io     = new Server(server, {
    cors             : {
        origin : '*',
        methods: ['GET', 'POST']
    },
    perMessageDeflate: false,
    pingTimeout      : 20000
});

const proxyUrl = `socks5://${process.env.SOCKS5_USERNAME}:${process.env.SOCKS5_PASSWORD}@${process.env.SOCKS5_HOST}:${process.env.SOCKS5_PORT}`;
const agent    = new SocksProxyAgent(proxyUrl);

const openai = new OpenAI({
    apiKey   : process.env.OPEN_AI_KEY,
    httpAgent: agent
});

const api = new ApiClient();

function log(...data: any) {
    const date = new Date(Date.now());
    console.log(`[${date.toLocaleDateString()} ${date.toLocaleTimeString()}]`, ...data);
}

io.on('connection', async (socket) => {
    const ip = socket.handshake.address.replace('::ffff:', '');

    const serverId = socket.handshake.auth.server_id;

    log(ip, 'Client connected');

    let threadId: string;

    async function handleRequiresAction(data: Run, runId: string, threadId: string) {
        try {
            const toolsOutputs = await Promise.all(
                data.required_action.submit_tool_outputs.tool_calls.map(async (toolCall) => {
                    switch (toolCall.function.name) {
                        case 'test_api':
                            return {
                                tool_call_id: toolCall.id,
                                output      : "{success: \"true\"}"
                            };

                        case 'execute_command':
                            const args = JSON.parse(toolCall.function.arguments);

                            log(ip, args);

                            const response = await api.post(`/servers/${serverId}/execute-command`, {
                                command: args.command
                            });

                            const responseData = await response.json();

                            console.log(responseData);

                            return {
                                tool_call_id: toolCall.id,
                                output: JSON.stringify(responseData)
                            };
                    }
                })
            );

            await submitToolOutputs(toolsOutputs, runId, threadId);
        } catch (error) {
            log("Error processing required action:", error);
        }
    }

    async function submitToolOutputs(toolOutputs, runId, threadId) {
        try {
            const stream = openai.beta.threads.runs.submitToolOutputsStream(
                threadId,
                runId,
                {tool_outputs: toolOutputs}
            );

            for await (const event of stream) {
                if (event.event == 'thread.message.created') {
                    socket.emit('message-stream-created');
                }

                if (event.event == 'thread.message.delta') {
                    log(event.data.delta.content);
                    socket.emit('message-stream-delta', event.data.delta.content[0].text.value);
                }

                if (event.event == 'thread.message.completed') {
                    socket.emit('message-stream-end', event.data.id);
                }
            }
        } catch (error) {
            log("Error submitting tool outputs:", error);
        }
    }

    socket.on('message', async (input: string) => {
        log(ip, 'Message received', input);

        const messageBody = {
            role   : 'user',
            content: [
                {
                    type: 'text',
                    text: input
                }
            ]
        };

        if (!threadId) {
            log(ip, 'Thread id not exists');

            const thread = await openai.beta.threads.create({
                messages: [messageBody]
            });

            log(ip, 'Thread id created', thread.id);

            threadId = thread.id;
        } else {
            log(ip, 'Message pushed to thread');
            await openai.beta.threads.messages.create(threadId, messageBody);
        }

        const run = openai.beta.threads.runs
                          .stream(threadId, {assistant_id: 'asst_EZAOdHbt0DCfCAiO3qOesgqb'})
                          .on('event', (event) => {
                              log(ip, event.event);

                              if (event.event === 'thread.run.requires_action') {
                                  handleRequiresAction(
                                      event.data,
                                      event.data.id,
                                      event.data.thread_id
                                  );
                              }
                          })
                          .on('textCreated', () => {
                              log(ip, 'Thread run created');
                              socket.emit('message-stream-created');
                          })
                          .on('textDelta', (textDelta) => {
                              socket.emit('message-stream-delta', textDelta.value);
                          })
                          .on('textDone', (_, snapshot) => {
                              log(ip, 'Thread run completed');
                              socket.emit('message-stream-end', snapshot.id);
                          });
    });

    socket.on('disconnect', () => {
        log(ip, 'Client disconnected');
    });
});

server.listen(process.env.HTTPS_PORT, () => {
    log(`Server running at https://localhost:${process.env.HTTPS_PORT}`);
});
