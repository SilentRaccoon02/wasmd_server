import type DataObject from './DataObject.js';
import { type RawData, type WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';

type INodes = Record<string, WebSocket>;

export default class Nodes {
    private readonly _nodes: INodes;

    public constructor () {
        this._nodes = {};
    }

    public readonly connection = (webSocket: WebSocket): void => {
        const uuid: string = uuidv4();
        const nodes: string[] = Object.keys(this._nodes);

        webSocket.on('message', (message: RawData) => {
            const jsonString: string = new TextDecoder().decode(message as ArrayBuffer);
            const dataObject: DataObject = JSON.parse(jsonString);
            this.send(dataObject);
        });

        webSocket.on('close', () => {
            Object.keys(this._nodes).forEach((key: string) => {
                this.send({ type: 'close', from: undefined, to: key, data: uuid });
            });
        });

        webSocket.on('error', (error: Error) => {
            console.log(error);
        });

        this._nodes[uuid] = webSocket;
        this.send({ type: 'uuid', from: undefined, to: uuid, data: undefined });
        this.send({ type: 'nodes', from: undefined, to: uuid, data: nodes });
    };

    private send (dataObject: DataObject): void {
        console.log(`send: type: ${dataObject.type} from: ${dataObject.from} to: ${dataObject.to}`);
        const jsonString: string = JSON.stringify(dataObject);
        const bytes: Uint8Array = new TextEncoder().encode(jsonString);
        this._nodes[dataObject.to]?.send(bytes);
    }
}
