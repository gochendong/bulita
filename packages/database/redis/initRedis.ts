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

// 如果是IPv4, 获取地址的前两位, 避免过于容易的逃避IP封禁策略
export function convertIP(ip) {
    const parts = ip.split('.');
    if (parts.length >= 2) {
        return `${parts[0]}.${parts[1]}`;
    }
    return ip; // 返回原始 IP 地址，如果无法分割成两部分
}

export function isValidIP(ip) {
    const pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    return pattern.test(ip);
}

export async function set(key: string, value: string, expireTime = Infinity) {
    if (isValidIP(value)) {
        value = convertIP(value);
    }
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

export function getNewRegisteredUserIpKey(ip: string) {
    // The value of v1 is ip
    // The value of v2 is count number
    return `${Prefix}:NewRegisteredUserIpV2:${convertIP(ip)}`;
}

export function getSealIpKey(ip: string) {
    return `${Prefix}:SealIp:${convertIP(ip)}`;
}

export async function getAllSealIp() {
    const allSealIpKeys = await keys(`${Prefix}:SealIp:*`);
    return allSealIpKeys.map((key) => key.replace(`${Prefix}:SealIp:`, ''));
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
