import redis from 'redis';
import { promisify } from 'util';
import config from '@bulita/config/server';
import logger from '@bulita/utils/logger';

export default function initRedis() {
    const client = redis.createClient({
        ...config.redis,
    });

    client.on('error', (err) => {
        logger.error('[redis]', err.message);
        process.exit(0);
    });

    return client;
}

const Prefix = 'chatroom';

const client = initRedis();

export const get = promisify(client.get).bind(client);

export const expire = promisify(client.expire).bind(client);

export const lpush = promisify(client.lpush).bind(client);

export const incr = promisify(client.incr).bind(client);

export async function set(key: string, value: string, expireTime = Infinity) {
    await promisify(client.set).bind(client)(key, value);
    if (expireTime !== Infinity) {
        await expire(key, expireTime);
    }
}

export const keys = promisify(client.keys).bind(client);

export async function has(key: string) {
    const v = await get(key);
    return v !== null;
}

export function getNewUserKey(userId: string) {
    return `${Prefix}:NewUser:${userId}`;
}

export function getSealUserKey(user: string) {
    return `${Prefix}:SealUser:${user}`;
}

export async function getAllSealUser() {
    const allSealUserKeys = await keys(`${Prefix}:SealUser:*`);
    return allSealUserKeys.map((key) => key.replace(`${Prefix}:SealUser:`, ''));
}

const Minute = 60;
const Hour = Minute * 60;
const Day = Hour * 24;

export const Redis = {
    get,
    set,
    has,
    expire,
    keys,
    Minute,
    Hour,
    Day,
    lpush,
    incr,
};

export const DisableSendMessageKey = `${Prefix}:DisableSendMessage`;
export const DisableNewUserSendMessageKey = `${Prefix}:DisableNewUserSendMessageKey`;
export const DisableRegisterUserSendMessageKey = `${Prefix}:DisableNoRegisterUserSendMessageKey`;
export const DisableRegisterUserKey = `${Prefix}:DisableRegisterUserKey`;
/** 群聊 AI 开关，存在且为 'true' 时开启 */
export const GroupAISwitchKey = `${Prefix}:GroupAISwitch`;

/** 管理员控制台可编辑的配置项，存在则覆盖 .env */
export function getAdminConfigKey(key: string) {
    return `${Prefix}:AdminConfig:${key}`;
}
