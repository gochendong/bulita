import { Socket } from 'socket.io';

export function getSocketIp(socket: Socket) {
    return (
        (socket.handshake.headers['x-forwarded-for'] as string) ||
        (socket.handshake.headers['x-real-ip'] as string) ||
        socket.request.connection.remoteAddress ||
        ''
    );
}
