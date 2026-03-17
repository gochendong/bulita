import { getAdminConfigKey, Redis } from '@bulita/database/redis/initRedis';

/** 管理员可在控制台修改的配置键，未在此列表的键不允许通过控制台写入 */
export const ADMIN_CONFIG_KEYS = [
    'DEFAULT_TITLE',
    'OPENAI_BASE_URL',
    'OPENAI_API_KEY',
    'OPENAI_MODEL',
    'OPENAI_CONTEXT_COUNT',
    'MAX_CALL_PER_MINUTES',
    'LIFT_BAN_DURATION',
    'SEAL_USER_DURATION',
    'MAX_GROUP_NUM',
    'PRIVATE_MSG_CALLBACK_DOMAIN',
] as const;

/** 仅在启动时读取的配置，修改后需重启服务才能生效 */
export const RESTART_REQUIRED_KEYS: readonly string[] = [];

/** 配置项中文说明（供管理台展示） */
export const ADMIN_CONFIG_LABELS: Record<string, string> = {
    DEFAULT_TITLE: '网站标题',
    OPENAI_BASE_URL: '默认 AI Base URL',
    OPENAI_API_KEY: '默认 AI API Key',
    OPENAI_MODEL: '默认 AI Model',
    OPENAI_CONTEXT_COUNT: '默认 AI 上下文数量',
    MAX_CALL_PER_MINUTES: '用户每分钟发言上限',
    LIFT_BAN_DURATION: '禁言自动解除时长(秒)',
    SEAL_USER_DURATION: '封禁用户时长(秒)',
    MAX_GROUP_NUM: '用户最大建群数(0=不允许建群，管理员不限)',
    PRIVATE_MSG_CALLBACK_DOMAIN: '私聊消息通知回调域名',
};

/** 代码内默认值，不依赖 .env */
export const DEFAULT_ADMIN_CONFIG: Record<string, string> = {
    BOTS: '',
    DEFAULT_TITLE: 'AI聊天室',
    DEFAULT_GROUP_NAME: 'AI聊天室',
    OPENAI_BASE_URL: 'https://api.openai.com/v1',
    OPENAI_API_KEY: '',
    OPENAI_MODEL: 'gpt-4o-mini',
    OPENAI_CONTEXT_COUNT: '10',
    MAX_CALL_PER_MINUTES: '8',
    LIFT_BAN_DURATION: '10',
    SEAL_USER_DURATION: '86400',
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
