import { getAdminConfigKey, Redis } from '@bulita/database/redis/initRedis';

/** 管理员可在控制台修改的配置键，未在此列表的键不允许通过控制台写入 */
export const ADMIN_CONFIG_KEYS = [
    'ENABLE_REGISTER_USER',
    'ONLY_SEARCH_DEFAULT_GROUP',
    'DEFAULT_TITLE',
    'DEFAULT_BOT_NAME',
    'DEFAULT_LINKMANS',
    'BANED_IP_LOCS',
    'MAX_CALL_PER_MINUTES',
    'NEW_USER_MAX_CALL_PER_MINUTES',
    'LIFT_BAN_DURATION',
    'SEAL_IP_DURATION',
    'SEAL_USER_DURATION',
    'REGISTER_IP_INTERVAL',
    'MAX_GROUP_NUM',
    'PRIVATE_MSG_CALLBACK_DOMAIN',
] as const;

/** 仅在启动时读取的配置，修改后需重启服务才能生效 */
export const RESTART_REQUIRED_KEYS: readonly string[] = [];

/** 配置项中文说明（供管理台展示） */
export const ADMIN_CONFIG_LABELS: Record<string, string> = {
    ENABLE_REGISTER_USER: '允许新用户注册',
    ONLY_SEARCH_DEFAULT_GROUP: '仅搜索默认群组',
    DEFAULT_TITLE: '网站标题',
    DEFAULT_BOT_NAME: '默认群组中自动回复的机器人名',
    DEFAULT_LINKMANS: '默认自动添加的联系人(逗号分隔)',
    BANED_IP_LOCS: '禁止发言的IP地区(逗号分隔)',
    MAX_CALL_PER_MINUTES: '用户每分钟发言上限',
    NEW_USER_MAX_CALL_PER_MINUTES: '新用户每分钟发言上限',
    LIFT_BAN_DURATION: '禁言自动解除时长(秒)',
    SEAL_IP_DURATION: '封禁IP时长(秒)',
    SEAL_USER_DURATION: '封禁用户时长(秒)',
    REGISTER_IP_INTERVAL: '同一IP注册间隔(秒)',
    MAX_GROUP_NUM: '用户最大建群数(0=不允许建群，管理员不限)',
    PRIVATE_MSG_CALLBACK_DOMAIN: '私聊消息通知回调域名',
};

/** 代码内默认值，不依赖 .env */
export const DEFAULT_ADMIN_CONFIG: Record<string, string> = {
    BOTS: '',
    ENABLE_REGISTER_USER: 'true',
    ONLY_SEARCH_DEFAULT_GROUP: 'true',
    DEFAULT_TITLE: 'AI聊天室',
    DEFAULT_GROUP_NAME: 'AI聊天室',
    DEFAULT_BOT_NAME: '',
    DEFAULT_LINKMANS: '',
    BANED_IP_LOCS: '',
    MAX_CALL_PER_MINUTES: '8',
    NEW_USER_MAX_CALL_PER_MINUTES: '5',
    LIFT_BAN_DURATION: '10',
    SEAL_IP_DURATION: '86400',
    SEAL_USER_DURATION: '86400',
    REGISTER_IP_INTERVAL: '60',
    MAX_GROUP_NUM: '0',
    PRIVATE_MSG_CALLBACK_DOMAIN: 'https://chat.bulita.net',
    NOTIFY_KEY: '',
};

/**
 * 获取运行时配置：仅从 Redis（管理台设置）读取，不读 .env
 */
export async function getConfig(key: string): Promise<string | undefined> {
    const v = await Redis.get(getAdminConfigKey(key));
    if (v !== null && v !== undefined) return v;
    return undefined;
}

/**
 * 获取配置：优先 Redis（管理台），其次 .env，最后代码默认值（减少但不取消对 .env 的依赖）
 */
export async function getConfigWithDefault(key: string): Promise<string> {
    const v = await getConfig(key);
    if (v !== null && v !== undefined && v !== '') return v;
    const envVal = process.env[key];
    if (envVal !== undefined && envVal !== '') return envVal;
    return DEFAULT_ADMIN_CONFIG[key] ?? '';
}

/**
 * 设置运行时配置（仅允许 ADMIN_CONFIG_KEYS 内的键）
 */
export async function setConfig(key: string, value: string): Promise<void> {
    if (!ADMIN_CONFIG_KEYS.includes(key as any)) {
        throw new Error(`不允许修改配置: ${key}`);
    }
    await Redis.set(getAdminConfigKey(key), value);
}

/**
 * 获取所有管理员可编辑配置的当前值（供管理台展示）。
 * 若 Redis 中已有该键（含设为空字符串），则显示 Redis 的值；否则显示 .env 或代码默认值。
 * 这样「留空」在控制台保存后，会真正存成空，再次打开时也显示为空。
 */
export async function getAllAdminConfig(): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    for (const key of ADMIN_CONFIG_KEYS) {
        const redisVal = await getConfig(key);
        if (redisVal !== undefined) {
            out[key] = redisVal;
        } else {
            out[key] = await getConfigWithDefault(key);
        }
    }
    return out;
}
