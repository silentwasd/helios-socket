export default interface MessageResource {
    message: string;
    file?: {
        url: string;
    };
    activeFiles?: number[];
    links?: string[];
}