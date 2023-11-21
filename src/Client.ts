import { type WebSocket, type RawData } from 'ws';
import type DataObject from './DataObject.js';

export default class Client {
    private readonly _uuid: string;
    private readonly _webSocket: WebSocket;

    public constructor (uuid: string, webSocket: WebSocket) {
        this._uuid = uuid;
        this._webSocket = webSocket;
        this._webSocket.binaryType = 'arraybuffer';
        this.bind();
    }

    public get uuid (): string {
        return this.uuid;
    }

    public send (dataObject: DataObject): void {
        console.log(`send: from ${dataObject.from} to ${dataObject.to}`);
        const jsonString: string = JSON.stringify(dataObject);
        const bytes: Uint8Array = new TextEncoder().encode(jsonString);
        this._webSocket.send(bytes);
    }

    private bind (): void {
        this._webSocket.on('message', (event: RawData) => {
            console.log(event);
        });

        this.send({
            type: 'uuid',
            from: 'server',
            to: this._uuid,
            data: this._uuid
        });
    }
}
