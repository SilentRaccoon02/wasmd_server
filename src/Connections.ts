import { WebSocket } from 'ws'
import { v4 as uuidv4 } from 'uuid'

interface Server {
    address: string
    port: number
}

enum DataType {
    SET_UUID = 'set-uuid',
    NODE_UUID = 'node-uuid',
    NODE_LIST = 'node-list',
    NODE_CLOSE = 'node-close',
    SERVER_UUID = 'server-uuid',
    SERVER_LIST = 'server-list',

    P2P_REQ = 'p2p-req',
    P2P_RES = 'p2p-res',
    P2P_ICE = 'p2p-ice',
    P2P_OFFER = 'p2p-offer',
    P2P_ANSWER = 'p2p-answer',
    P2P_CHUNK = 'p2p-chunk',
    P2P_COMPLETE = 'p2p-complete',
    P2P_SPEED = 'p2p-speed',

    FILE_PROCESS = 'file-process',
    FILE_RESULT = 'file-result',
    MODULE_STATE = 'module-state'
}

interface Data {
    type: DataType
    from: string | undefined
    to: string
    data: any | undefined
}

interface ModuleState {
    queued: number
    complete: number
    benchmark: number
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

    private readonly _dict = new Map<string, string>()
    private readonly _nodes = new Map<string, WebSocket>()
    private readonly _servers = new Map<string, WebSocket>()
    private readonly _nodeStates = new Map<string, ModuleState>()
    private readonly _serverStates = new Map<string, ModuleState>()

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
                    const servers = Array.from(this._servers.keys())

                    this._nodes.set(data.from, webSocket)
                    this.send(DataType.NODE_LIST, data.from, nodes)
                    this.send(DataType.SERVER_LIST, data.from, servers)

                    for (const entire of this._serverStates.entries()) {
                        this.forward({
                            type: DataType.MODULE_STATE,
                            from: entire[0],
                            to: data.from,
                            data: entire[1]
                        })
                    }

                    console.log(`open node ${data.from.substring(0, 8)}`)
                    return
                }
                case DataType.SERVER_UUID: {
                    this._servers.set(data.from, webSocket)
                    this._serverStates.set(data.from, { queued: 0, complete: 0, benchmark: 0 })
                    console.log(`open server ${data.from.substring(0, 8)}`)
                    return
                }
                case DataType.P2P_REQ: { this.forward(data); return }
                case DataType.P2P_RES: { this.forward(data); return }
                case DataType.P2P_ICE : { this.forward(data); return }
                case DataType.P2P_OFFER: { this.forward(data); return }
                case DataType.P2P_ANSWER: { this.forward(data); return }
                case DataType.FILE_PROCESS: { this.onFileProcess(data); return }
                case DataType.FILE_RESULT: { this.onFileResult(data); return }
                case DataType.MODULE_STATE: { this.onModuleState(data); return }
                default: { console.log('unknown type') }
            }
        })

        webSocket.on('close', () => {
            for (const entire of this._nodes.entries()) {
                if (entire[1] === webSocket) {
                    this._nodes.delete(entire[0])
                    this._nodeStates.delete(entire[0])
                    this.updateState()

                    for (const key of this._nodes.keys()) {
                        this.send(DataType.NODE_CLOSE, key, entire[0])
                    }

                    console.log(`close node ${entire[0].substring(0, 8)}`)
                    return
                }
            }

            for (const entire of this._servers.entries()) {
                if (entire[1] === webSocket) {
                    this._servers.delete(entire[0])
                    this._serverStates.delete(entire[0])

                    console.log(`close server ${entire[0].substring(0, 8)}`)
                    return
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
            console.log(`open server ${data.from.substring(0, 8)}`)

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
                    this._serverStates.set(data.from, { queued: 0, complete: 0, benchmark: 0 })
                    return
                }
                case DataType.FILE_PROCESS: { this.onFileProcess(data); return }
                case DataType.FILE_RESULT: { this.onFileResult(data); return }
                case DataType.MODULE_STATE: { this.onModuleState(data); return }
                default: { console.log('unknown type') }
            }
        })

        webSocket.on('close', () => {
            for (const entire of this._servers.entries()) {
                if (entire[1] === webSocket) {
                    this._servers.delete(entire[0])
                    this._serverStates.delete(entire[0])

                    console.log(`close server ${entire[0].substring(0, 8)}`)
                    return
                }
            }
        })

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

    private onFileProcess (data: Data): void {
        if (data.from === undefined) { return }

        if (this._servers.get(data.from) === undefined) {
            this._dict.set(data.data.fileId, data.from)
            this.send(DataType.FILE_PROCESS, data.to, data.data)
            return
        }

        if (this._nodes.size === 0) { return }
        this._dict.set(data.data.fileId, data.from)
        this.send(DataType.FILE_PROCESS, this._nodes.keys().next().value, data.data)
    }

    private onFileResult (data: Data): void {
        if (data.from === undefined) { return }
        const to = this._dict.get(data.data.fileId)
        if (to === undefined) { return }
        this.send(DataType.FILE_RESULT, to, data.data)
    }

    private onModuleState (data: Data): void {
        if (data.from === undefined) { return }

        if (this._servers.get(data.from) !== undefined) {
            this._serverStates.set(data.from, data.data)

            for (const uuid of this._nodes.keys()) {
                data.to = uuid
                this.forward(data)
            }

            return
        }

        this._nodeStates.set(data.from, data.data)
        this.updateState()
    }

    private updateState (): void {
        const total = { queued: 0, complete: 0, benchmark: 0 }

        for (const state of this._nodeStates.values()) {
            total.queued += state.queued
            total.complete += state.complete
            total.benchmark += state.benchmark
        }

        for (const uuid of this._servers.keys()) {
            this.send(DataType.MODULE_STATE, uuid, total)
        }
    }
}
