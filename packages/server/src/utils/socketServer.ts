import { Server } from 'socket.io';

let io: Server | null = null;

export function setSocketServer(server: Server) {
    io = server;
}

export function getSocketServer() {
    if (!io) {
        throw new Error('socket server not ready');
    }
    return io;
}
