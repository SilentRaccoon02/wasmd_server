import Client from './Client.js';
import type { WebSocketServer, WebSocket } from 'ws';

export default class ClientsManager {
    private readonly webSocketServer: WebSocketServer;
    private readonly clients: Client[];
    private lastClientId: number;

    public constructor (webSocketServer: WebSocketServer) {
        this.webSocketServer = webSocketServer;
        this.clients = [];
        this.lastClientId = -1;
    }

    public bind (): void {
        this.webSocketServer.on('connection', (webSocket: WebSocket) => {
            this.clients.push(new Client(this.nextClientId(), webSocket));
        });
    }

    private nextClientId (): number {
        return (++this.lastClientId);
    }
}
