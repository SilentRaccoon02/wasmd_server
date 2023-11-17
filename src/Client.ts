import { type WebSocket } from 'ws';

export default class Client {
    private readonly id: number;
    private readonly webSocket: WebSocket;

    public constructor (id: number, webSocket: WebSocket) {
        this.id = id;
        this.webSocket = webSocket;
    }
}
