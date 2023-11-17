import express from 'express';
import path from 'path';
import type http from 'http';
import type internal from 'stream';
import { WebSocketServer, type WebSocket } from 'ws';

const PORT: number = 2512;
const BUILD_DIR: string = path.resolve();
const STATIC_DIR: string = path.resolve(BUILD_DIR, '..', 'wasmd_web', 'build');

const app: express.Application = express();
const httpServer: http.Server = app.listen(PORT, () => { console.log(PORT); });
const webSocketServer: WebSocketServer = new WebSocketServer({ noServer: true });

app.use(express.static(STATIC_DIR));

httpServer.on('upgrade', (req: http.IncomingMessage, socket: internal.Duplex, head: Buffer) => {
    webSocketServer.handleUpgrade(req, socket, head, (webSocket: WebSocket) => {
        webSocketServer.emit('connection', webSocket, req);
    });
});
