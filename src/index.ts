import Connections from './Connections.js'
import express from 'express'
import path from 'path'
import { WebSocketServer } from 'ws'

const DIR = path.resolve()
const STATIC_DIR = path.resolve(DIR, 'build', 'static')
const PORT = process.argv.length === 3 ? process.argv[2] : (process.env.PORT ?? 3000)

const app = express()
const httpServer = app.listen(PORT, () => { console.log(`running on port ${PORT}`) })
const webSocketServer = new WebSocketServer({ noServer: true })
const connections = new Connections(Number(PORT))

app.use(express.static(STATIC_DIR))
webSocketServer.on('connection', connections.connection)

httpServer.on('upgrade', (req, socket, head) => {
    webSocketServer.handleUpgrade(req, socket, head, (webSocket) => {
        webSocketServer.emit('connection', webSocket, req)
    })
})
