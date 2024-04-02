import { Socket } from 'socket.io';
import {
    getNewUserKey,
    getSealUserKey,
    Redis,
} from '@bulita/database/redis/initRedis';

export const CALL_SERVICE_FREQUENTLY = '发消息过于频繁, 请冷静一会再试';
export const NEW_USER_CALL_SERVICE_FREQUENTLY =
    '发消息过于频繁, 你还处于新手期, 先冷静一会再试';

const MaxCallPerMinutes = parseInt(process.env.MAX_CALL_PER_MINUTES);
const NewUserMaxCallPerMinutes = parseInt(
    process.env.NEW_USER_MAX_CALL_PER_MINUTES,
);

const AutoSealDuration = parseInt(process.env.LIFT_BAN_DURATION);

type Options = {
    maxCallPerMinutes?: number;
    newUserMaxCallPerMinutes?: number;
    clearDataInterval?: number;
};

/**
 * 限制接口调用频率
 */
export default function frequency(
    socket: Socket,
    {
        maxCallPerMinutes = MaxCallPerMinutes,
        newUserMaxCallPerMinutes = NewUserMaxCallPerMinutes,
    }: Options = {},
) {
    let callTimes: Record<string, number> = {};

    // 每60s清空一次次数统计
    setInterval(() => {
        callTimes = {};
    }, Redis.Minute * 1000);

    return async ([event, , cb]: MiddlewareArgs, next: MiddlewareNext) => {
        if (event !== 'sendMessage') {
            next();
        } else {
            const socketId = socket.id;
            const count = callTimes[socketId] || 0;

            const isNewUser =
                socket.data.user &&
                (await Redis.has(getNewUserKey(socket.data.user)));
            if (isNewUser && count >= newUserMaxCallPerMinutes) {
                // new user limit
                cb(NEW_USER_CALL_SERVICE_FREQUENTLY);
                await Redis.set(
                    getSealUserKey(socket.data.user),
                    socket.data.user,
                    AutoSealDuration,
                );
                callTimes = {};
            } else if (count >= maxCallPerMinutes) {
                // normal user limit
                cb(CALL_SERVICE_FREQUENTLY);
                await Redis.set(
                    getSealUserKey(socket.data.user),
                    socket.data.user,
                    AutoSealDuration,
                );
                callTimes = {};
            } else {
                callTimes[socketId] = count + 1;
                next();
            }
        }
    };
}
