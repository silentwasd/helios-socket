export default interface SessionResource {
    data: {
        id: string;
        chat_id: number;
        service_id: number | null;
    };

    metadata: any;
    assistant_id: string;
}