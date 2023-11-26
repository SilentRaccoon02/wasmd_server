import { type WebSocket } from 'ws'
import { v4 as uuidv4 } from 'uuid'

enum DataType {
    NODE_UUID = 'node-uuid',
    NODE_LIST = 'node-list',
    NODE_CLOSE = 'node-close'
}

interface Data {
    type: DataType
    from: string | undefined
    to: string
    data: any | undefined
}

export default class Connections {
    private readonly _nodes = new Map<string, WebSocket>()

    public readonly connection = (webSocket: WebSocket): void => {
        const uuid = uuidv4()
        const nodes = Array.from(this._nodes.keys())

        webSocket.on('message', (message) => {
            const jsonString = new TextDecoder().decode(message as ArrayBuffer)
            const data = JSON.parse(jsonString)
            this.send(data)
        })

        webSocket.on('close', () => {
            console.log(`close ${uuid}`)
            this._nodes.delete(uuid)
            for (const key of this._nodes.keys()) {
                this.send({ type: DataType.NODE_CLOSE, from: undefined, to: key, data: uuid })
            }
        })

        webSocket.on('error', (error) => { console.log(error) })
        webSocket.binaryType = 'arraybuffer'

        this._nodes.set(uuid, webSocket)
        this.send({ type: DataType.NODE_UUID, from: undefined, to: uuid, data: undefined })
        this.send({ type: DataType.NODE_LIST, from: undefined, to: uuid, data: nodes })
        console.log(`open ${uuid}`)
    }

    private send (data: Data): void {
        const jsonString = JSON.stringify(data)
        const bytes = new TextEncoder().encode(jsonString)
        this._nodes.get(data.to)?.send(bytes)
    }
}
