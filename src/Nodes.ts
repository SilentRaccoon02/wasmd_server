import { type WebSocket } from 'ws'
import { v4 as uuidv4 } from 'uuid'

interface DataObject {
    type: string
    from: string | undefined
    to: string
    data: any | undefined
}

export default class Nodes {
    private readonly _nodes = new Map<string, WebSocket>()

    public readonly connection = (webSocket: WebSocket): void => {
        const uuid = uuidv4()
        const nodes = Array.from(this._nodes.keys())

        webSocket.on('message', (message) => {
            const jsonString = new TextDecoder().decode(message as ArrayBuffer)
            const dataObject = JSON.parse(jsonString)
            this.send(dataObject)
        })

        webSocket.on('close', () => {
            this._nodes.delete(uuid)
            for (const key of this._nodes.keys()) {
                this.send({ type: 'close', from: undefined, to: key, data: uuid })
            }
        })

        webSocket.on('error', (error) => { console.log(error) })
        webSocket.binaryType = 'arraybuffer'

        this._nodes.set(uuid, webSocket)
        this.send({ type: 'uuid', from: undefined, to: uuid, data: undefined })
        this.send({ type: 'nodes', from: undefined, to: uuid, data: nodes })
    }

    private send (dataObject: DataObject): void {
        console.log(`send: type: ${dataObject.type} from: ${dataObject.from} to: ${dataObject.to}`)
        const jsonString = JSON.stringify(dataObject)
        const bytes = new TextEncoder().encode(jsonString)
        this._nodes.get(dataObject.to)?.send(bytes)
    }
}
