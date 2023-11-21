import Client from './Client.js';
import type DataObject from './DataObject.js';
import type { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';

export default class ClientsManager {
    private readonly webSocketServer: WebSocketServer;
    private readonly clients: Client[];

    public constructor (webSocketServer: WebSocketServer) {
        this.webSocketServer = webSocketServer;
        this.clients = [];
        this.bind();
    }

    public send (dataObject: DataObject): void {
        const to: Client | undefined = this.clients.find((client: Client) => client.uuid === dataObject.to);

        if (to !== undefined) {
            to.send(dataObject);
        } else {
            console.log(`send: from ${dataObject.from} to ${dataObject.to}: undefined`);
        }
    }

    private bind (): void {
        this.webSocketServer.on('connection', (webSocket: WebSocket) => {
            this.clients.push(new Client(uuidv4(), webSocket));
        });
    }
}
