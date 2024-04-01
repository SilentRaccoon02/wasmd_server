import { WebSocket } from 'ws'
import { v4 as uuidv4 } from 'uuid'

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
    MODULE_STATE = 'module-state',

    WS_COMPLETE = 'ws-complete',
    WS_SPEED = 'ws-speed'
}

interface Config {
    address: string
    port: number
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

interface Node {
    webSocket: WebSocket
    moduleState: ModuleState
    speed: number
}

interface Server {
    webSocket: WebSocket
    moduleState: ModuleState
    speed: number
}

interface Task {
    sourceFile: string
    node: string | undefined
}

interface Timestamp {
    time: number
    length: number
}

export default class Connections {
    private static readonly _config: Config[] = [
        { address: '127.0.0.1', port: 3000 },
        { address: '127.0.0.1', port: 3001 },
        { address: '127.0.0.1', port: 3002 }
    ]

    private static readonly _main = this._config[0]
    private static readonly _thresh = 2

    private _uuid: string | undefined
    private readonly _address: string
    private readonly _port: number
    private readonly _nodes = new Map<string, Node>()
    private readonly _servers = new Map<string, Server>()
    private readonly _files = new Map<string, string>()
    private readonly _tasks = new Map<string, Task>()
    private readonly _timestamps = new Map<string, Timestamp>()
    private readonly _moduleState: ModuleState = { queued: 0, complete: 0, benchmark: 0 }

    public constructor (address: string, port: number) {
        this._address = address
        this._port = port

        if (this.compareConfigs(Connections._main)) {
            this._uuid = uuidv4()
            return
        }

        this.connectServer(Connections._main)
    }

    public readonly connection = (webSocket: WebSocket): void => {
        if (this._uuid === undefined) { return }

        webSocket.on('message', (message) => { this.onMessage(webSocket, message) })
        webSocket.on('close', () => { this.onClose(webSocket) })
        webSocket.on('error', (error) => { console.log(error) })
        webSocket.binaryType = 'arraybuffer'

        const jsonString = JSON.stringify(
            { type: DataType.SET_UUID, to: uuidv4(), from: this._uuid, data: undefined })
        const bytes = new TextEncoder().encode(jsonString)
        webSocket.send(bytes)
    }

    private compareConfigs (config: Config): boolean {
        return config.address === this._address && config.port === this._port
    }

    private connectServer (config: Config): void {
        const webSocket = new WebSocket(`ws://${config.address}:${config.port}`)
        webSocket.on('message', (message) => { this.onMessage(webSocket, message) })
        webSocket.on('close', () => { this.onClose(webSocket) })
        webSocket.on('error', (error) => { console.log(error) })
        webSocket.binaryType = 'arraybuffer'
    }

    private onMessage (webSocket: WebSocket, message: any): void {
        const jsonString = new TextDecoder().decode(message as ArrayBuffer)
        const data: Data = JSON.parse(jsonString)

        switch (data.type) {
            case DataType.P2P_REQ: { this.forward(data); return }
            case DataType.P2P_RES: { this.forward(data); return }
            case DataType.P2P_ICE : { this.forward(data); return }
            case DataType.P2P_OFFER: { this.forward(data); return }
            case DataType.P2P_ANSWER: { this.forward(data); return }

            case DataType.SET_UUID: { this.onSetUUID(data, webSocket); return }
            case DataType.NODE_UUID: { this.onNodeUUID(data, webSocket); return }
            case DataType.SERVER_UUID: { this.onServerUUID(data, webSocket); return }
            case DataType.FILE_PROCESS: { this.onFileProcess(data); return }
            case DataType.FILE_RESULT: { this.onFileResult(data); return }
            case DataType.MODULE_STATE: { this.onModuleState(data); return }
            case DataType.WS_COMPLETE: { this.onCompleteWS(data); return }
            case DataType.WS_SPEED: { this.onSpeedWS(data); return }
            default: { console.log(`unknown type ${data.type}`) }
        }
    }

    private onClose (webSocket: WebSocket): void {
        for (const node of this._nodes.entries()) {
            if (node[1].webSocket === webSocket) {
                this._nodes.delete(node[0])

                for (const uuid of this._nodes.keys()) {
                    this.send(DataType.NODE_CLOSE, uuid, node[0])
                }

                for (const task of this._tasks.values()) {
                    if (task.node === node[0]) { task.node = undefined }
                }

                this.updateState()
                this.processFile()

                console.log(`close node ${node[0].substring(0, 8)}`)
                return
            }
        }

        for (const server of this._servers.entries()) {
            if (server[1].webSocket === webSocket) {
                this._servers.delete(server[0])
                console.log(`close server ${server[0].substring(0, 8)}`)
                return
            }
        }
    }

    private onSetUUID (data: Data, webSocket: WebSocket): void {
        if (data.from === undefined) { return }

        if (this._uuid === undefined) {
            this._uuid = data.to

            for (const config of Connections._config.slice(1)) {
                if (this.compareConfigs(config)) { break }
                this.connectServer(config)
            }
        }

        this._servers.set(data.from, {
            webSocket,
            moduleState: { queued: 0, complete: 0, benchmark: 0 },
            speed: 0
        })

        this.send(DataType.SERVER_UUID, data.from, undefined)
        console.log(`open server ${data.from.substring(0, 8)}`)
    }

    private onNodeUUID (data: Data, webSocket: WebSocket): void {
        if (data.from === undefined) { return }

        const nodes = Array.from(this._nodes.keys())
        const servers = Array.from(this._servers.keys())

        this._nodes.set(data.from, {
            webSocket,
            moduleState: { queued: 0, complete: 0, benchmark: 0 },
            speed: 0
        })

        this.send(DataType.NODE_LIST, data.from, nodes)
        this.send(DataType.SERVER_LIST, data.from, servers)

        for (const server of this._servers.entries()) {
            this.forward({
                type: DataType.MODULE_STATE,
                from: server[0],
                to: data.from,
                data: server[1].moduleState
            })
        }

        console.log(`open node ${data.from.substring(0, 8)}`)
    }

    private onServerUUID (data: Data, webSocket: WebSocket): void {
        if (data.from === undefined) { return }

        this._servers.set(data.from, {
            webSocket,
            moduleState: { queued: 0, complete: 0, benchmark: 0 },
            speed: 0
        })

        console.log(`open server ${data.from.substring(0, 8)}`)
    }

    private onFileProcess (data: Data): void { // TODO union
        if (data.from === undefined) { return }

        this._timestamps.set(data.data.fileId, {
            time: performance.now(),
            length: JSON.stringify(data).length
        })

        this.send(DataType.WS_COMPLETE, data.from, data.data.fileId)
        const node = this._nodes.get(data.from)
        const server = this._servers.get(data.from)

        if (node !== undefined) {
            this._files.set(data.data.fileId, data.from)
            this.send(DataType.FILE_PROCESS, data.to, data.data)
        }

        if (server !== undefined) {
            this._tasks.set(data.data.fileId, {
                sourceFile: data.data.sourceFile,
                node: undefined
            })

            this._files.set(data.data.fileId, data.from)
            this.processFile()
        }
    }

    private onFileResult (data: Data): void { // TODO union
        if (data.from === undefined) { return }

        this._timestamps.set(data.data.fileId, {
            time: performance.now(),
            length: JSON.stringify(data).length
        })

        this.send(DataType.WS_COMPLETE, data.from, data.data.fileId)
        const node = this._nodes.get(data.from)
        const server = this._servers.get(data.from)

        if (node !== undefined) {
            const to = this._files.get(data.data.fileId)

            if (to !== undefined) {
                this._files.delete(data.data.fileId)
                this.send(DataType.FILE_RESULT, to, data.data)
            }

            this._tasks.delete(data.data.fileId)
            this.processFile()
        }

        if (server !== undefined) {
            const to = this._files.get(data.data.fileId)

            if (to !== undefined) {
                this._files.delete(data.data.fileId)
                this.send(DataType.FILE_RESULT, to, data.data)
            }
        }
    }

    private onModuleState (data: Data): void {
        if (data.from === undefined) { return }

        const node = this._nodes.get(data.from)
        const server = this._servers.get(data.from)

        if (node !== undefined) {
            node.moduleState = data.data
            this.updateState()
        }

        if (server !== undefined) {
            server.moduleState = data.data

            for (const uuid of this._nodes.keys()) {
                data.to = uuid
                this.forward(data)
            }
        }
    }

    private onCompleteWS (data: Data): void {
        if (data.from === undefined) { return }

        const timestamp = this._timestamps.get(data.data)
        if (timestamp === undefined) { return }

        const seconds = (performance.now() - timestamp.time) / 1000
        const megabytes = timestamp.length / (1024 * 1024)
        const speed = megabytes / seconds

        const node = this._nodes.get(data.from)
        const server = this._servers.get(data.from)

        if (node !== undefined) {
            node.speed = speed

            for (const server of this._servers) {
                this.send(DataType.WS_SPEED, data.from, {
                    uuid: server[0],
                    speed: Math.min(server[1].speed, node.speed)
                })
            }
        }

        if (server !== undefined) {
            server.speed = speed
            this.send(DataType.WS_SPEED, data.from, speed)
        }

        this._timestamps.delete(data.data)
    }

    private onSpeedWS (data: Data): void {
        if (data.from === undefined) { return }

        const node = this._nodes.get(data.from)
        const server = this._servers.get(data.from)

        if (node !== undefined) {
            node.speed = data.data

            for (const server of this._servers) {
                this.send(DataType.WS_SPEED, data.from, {
                    uuid: server[0],
                    speed: Math.min(server[1].speed, node.speed)
                })
            }
        }

        if (server !== undefined) {
            server.speed = data.data
        }
    }

    private updateState (): void {
        let totalQueued = 0
        let totalComplete = 0
        let totalBenchmark = 0

        for (const node of this._nodes.values()) {
            totalQueued += node.moduleState.queued
            totalComplete += node.moduleState.complete
            totalBenchmark += node.moduleState.benchmark
        }

        if (this._moduleState.queued !== totalQueued ||
            this._moduleState.complete !== totalComplete ||
            this._moduleState.benchmark !== totalBenchmark) {
            this._moduleState.queued = totalQueued
            this._moduleState.complete = totalComplete
            this._moduleState.benchmark = totalBenchmark

            for (const uuid of this._servers.keys()) {
                this.send(DataType.MODULE_STATE, uuid, this._moduleState)
            }
        }
    }

    private processFile (): void {
        const task = this.findTask()
        if (task === undefined) { return }

        const uuid = this.selectNode()
        if (uuid === undefined) { return }

        task[1].node = uuid

        this.send(DataType.FILE_PROCESS, uuid, {
            fileId: task[0],
            sourceFile: task[1].sourceFile
        })
    }

    private findTask (): [string, Task] | undefined {
        for (const task of this._tasks.entries()) {
            if (task[1].node === undefined) {
                return task
            }
        }

        return undefined
    }

    private selectNode (): string | undefined {
        let totalCount = 0
        let totalBenchmark = 0

        for (const node of this._nodes.entries()) {
            if (node[1].moduleState.benchmark > 0) {
                totalCount++
                totalBenchmark += node[1].moduleState.benchmark
            }
        }

        let minNode
        let minDelta = Number.MAX_SAFE_INTEGER
        const avgBenchmark = totalBenchmark === 0 ? 0 : totalBenchmark / totalCount

        for (const node of this._nodes.entries()) {
            const benchmark = node[1].moduleState.benchmark
            if (benchmark === 0) { continue }

            const queued = node[1].moduleState.queued
            const complete = node[1].moduleState.complete
            const delta = queued - complete

            const deviation = (benchmark - avgBenchmark) / avgBenchmark
            const thresh = Math.round(Connections._thresh * deviation + Connections._thresh)

            if (delta < minDelta && delta < thresh) {
                minDelta = delta
                minNode = node[0]
            }
        }

        return minNode
    }

    private send (type: DataType, to: string, data: any): void {
        const jsonString = JSON.stringify({ type, to, from: this._uuid, data })
        const bytes = new TextEncoder().encode(jsonString)
        this._nodes.get(to)?.webSocket.send(bytes)
        this._servers.get(to)?.webSocket.send(bytes)
    }

    private forward (data: Data): void {
        const jsonString = JSON.stringify(data)
        const bytes = new TextEncoder().encode(jsonString)
        this._nodes.get(data.to)?.webSocket.send(bytes)
        this._servers.get(data.to)?.webSocket.send(bytes)
    }
}
