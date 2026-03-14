import { Socket } from 'socket.io';
import {
    getSealUserKey,
    Redis,
} from '@bulita/database/redis/initRedis';
import { getConfigWithDefault } from '../utils/runtimeConfig';

export const CALL_SERVICE_FREQUENTLY = '发消息过于频繁, 请冷静一会再试';

type Options = {
    maxCallPerMinutes?: number;
    clearDataInterval?: number;
};

/**
 * 限制接口调用频率
 */
export default function frequency(socket: Socket, _options: Options = {}) {
    let callTimes: Record<string, number> = {};

    // 每60s清空一次次数统计
    setInterval(() => {
        callTimes = {};
    }, Redis.Minute * 1000);

    return async ([event, , cb]: MiddlewareArgs, next: MiddlewareNext) => {
        if (event !== 'sendMessage') {
            next();
            return;
        }
        const maxCallStr = await getConfigWithDefault('MAX_CALL_PER_MINUTES');
        const liftBanStr = await getConfigWithDefault('LIFT_BAN_DURATION');
        const maxCallPerMinutes = parseInt(maxCallStr, 10) || 8;
        const autoSealDuration = parseInt(liftBanStr, 10) || 10;

        const socketId = socket.id;
        const count = callTimes[socketId] || 0;

        if (count >= maxCallPerMinutes) {
            cb(CALL_SERVICE_FREQUENTLY);
            await Redis.set(
                getSealUserKey(socket.data.user),
                socket.data.user,
                autoSealDuration,
            );
            callTimes = {};
        } else {
            callTimes[socketId] = count + 1;
            next();
        }
    };
}
