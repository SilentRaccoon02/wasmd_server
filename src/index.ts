import Nodes from './Nodes.js'
import express from 'express'
import path from 'path'
import { WebSocketServer } from 'ws'

const PORT = 2512
const BUILD_DIR = path.resolve()
const STATIC_DIR = path.resolve(BUILD_DIR, '..', 'wasmd_web', 'build')

const app = express()
const httpServer = app.listen(PORT, () => { console.log(`running on port ${PORT}`) })
const webSocketServer = new WebSocketServer({ noServer: true })
const nodes = new Nodes()

app.use(express.static(STATIC_DIR))
webSocketServer.on('connection', nodes.connection)

httpServer.on('upgrade', (req, socket, head) => {
    webSocketServer.handleUpgrade(req, socket, head, (webSocket) => {
        webSocketServer.emit('connection', webSocket, req)
    })
})
