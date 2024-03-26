import { WebSocket } from 'ws'
import { v4 as uuidv4 } from 'uuid'

interface Server {
    address: string
    port: number
}

enum DataType {
    SET_UUID = 'set-uuid',
    NODE_UUID = 'node-uuid',
    SERVER_UUID = 'server-uuid',

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
    private static readonly _configuration: Server[] = [
        { address: '127.0.0.1', port: 3000 },
        { address: '127.0.0.1', port: 3001 },
        { address: '127.0.0.1', port: 3002 }
    ]

    private static readonly _main = this._configuration[0]

    private _uuid: string | undefined
    private readonly _port: number
    private readonly _address = '127.0.0.1'

    private readonly _nodes = new Map<string, WebSocket>()
    private readonly _servers = new Map<string, WebSocket>()

    public constructor (port: number) {
        this._port = port

        if (this.compare(Connections._main)) {
            this._uuid = uuidv4()
            return
        }

        this.connect(Connections._main)
    }

    public readonly connection = (webSocket: WebSocket): void => {
        if (this._uuid === undefined) { return }

        webSocket.on('message', (message) => {
            const jsonString = new TextDecoder().decode(message as ArrayBuffer)
            const data: Data = JSON.parse(jsonString)

            if (data.from === undefined) { return }

            switch (data.type) {
                case DataType.NODE_UUID: {
                    const nodes = Array.from(this._nodes.keys())
                    this._nodes.set(data.from, webSocket)
                    this.send(DataType.NODE_LIST, data.from, nodes)
                    console.log(`open node ${data.from.substring(0, 8)}`)
                    return
                }
                case DataType.SERVER_UUID: {
                    this._servers.set(data.from, webSocket)
                    console.log(`open server ${data.from.substring(0, 8)}`)
                    return
                }
                default: {
                    this.forward(data)
                }
            }
        })

        webSocket.on('close', () => {
            for (const entire of this._nodes.entries()) {
                if (entire[1] === webSocket) {
                    this._nodes.delete(entire[0])

                    for (const key of this._nodes.keys()) {
                        this.send(DataType.NODE_CLOSE, key, entire[0])
                    }

                    console.log(`close node ${entire[0].substring(0, 8)}`)
                }
            }
        })

        webSocket.on('error', (error) => { console.log(error) })
        webSocket.binaryType = 'arraybuffer'

        const jsonString = JSON.stringify(
            { type: DataType.SET_UUID, to: uuidv4(), from: this._uuid, data: undefined })
        const bytes = new TextEncoder().encode(jsonString)
        webSocket.send(bytes)
    }

    private connect (server: Server): void {
        const webSocket = new WebSocket(`ws://${server.address}:${server.port}`)

        webSocket.on('message', (message) => {
            const jsonString = new TextDecoder().decode(message as ArrayBuffer)
            const data: Data = JSON.parse(jsonString)

            if (data.from === undefined) { return }
            this._servers.set(data.from, webSocket)

            switch (data.type) {
                case DataType.SET_UUID: {
                    if (this._uuid === undefined) {
                        this._uuid = data.to

                        for (const server of Connections._configuration.slice(1)) {
                            if (this.compare(server)) { break }
                            this.connect(server)
                        }
                    }

                    this.send(DataType.SERVER_UUID, data.from, undefined)
                    return
                }
                default: {
                    console.log('unknown type')
                }
            }
        })

        webSocket.on('close', () => { console.log('close') })
        webSocket.on('error', (error) => { console.log(error) })
        webSocket.binaryType = 'arraybuffer'
    }

    private compare (server: Server): boolean {
        return server.address === this._address && server.port === this._port
    }

    private send (type: DataType, to: string, data: any): void {
        const jsonString = JSON.stringify({ type, to, from: this._uuid, data })
        const bytes = new TextEncoder().encode(jsonString)
        this._nodes.get(to)?.send(bytes)
        this._servers.get(to)?.send(bytes)
    }

    private forward (data: Data): void {
        const jsonString = JSON.stringify(data)
        const bytes = new TextEncoder().encode(jsonString)
        this._nodes.get(data.to)?.send(bytes)
        this._servers.get(data.to)?.send(bytes)
    }
}
