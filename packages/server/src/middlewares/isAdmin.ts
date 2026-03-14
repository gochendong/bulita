import config from '@bulita/config/server';
import { Socket } from 'socket.io';

export const YOU_ARE_NOT_ADMINISTRATOR = '你不是管理员';

/**
 * 拦截非管理员用户请求需要管理员权限的接口
 */
export default function isAdmin(socket: Socket) {
    const requireAdminEvent = new Set([
        'sealUser',
        'getSealList',
        'resetUserPassword',
        'setUserTag',
        'getUserIps',
        'sealIp',
        'getSealIpList',
        'toggleSendMessage',
        'toggleNewUserSendMessage',
        'toggleGroupAI',
        'getSystemConfig',
        'setSystemConfig',
        'getAdminUserByUsername',
        'deleteUser',
    ]);
    return async ([event, , cb]: MiddlewareArgs, next: MiddlewareNext) => {
        socket.data.isAdmin = !!socket.data.user && !!socket.data.isAdmin;
        const isAdminEvent = requireAdminEvent.has(event);
        if (!socket.data.isAdmin && isAdminEvent) {
            cb(YOU_ARE_NOT_ADMINISTRATOR);
        } else {
            next();
        }
    };
}
