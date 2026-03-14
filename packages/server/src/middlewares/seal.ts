import { SEAL_TEXT } from '@bulita/utils/const';
import { Socket } from 'socket.io';
import {
    getSealUserKey,
    Redis,
} from '@bulita/database/redis/initRedis';

/**
 * 拦截被封禁用户的请求
 */
export default function seal(socket: Socket) {
    return async ([, , cb]: MiddlewareArgs, next: MiddlewareNext) => {
        const isSealUser =
            socket.data.user &&
            (await Redis.has(getSealUserKey(socket.data.user)));

        if (isSealUser) {
            cb(SEAL_TEXT);
        } else {
            next();
        }
    };
}
