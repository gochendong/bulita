import ip from 'ip';

const { env } = process;

function buildMongoDatabaseUrl() {
    const host = env.MONGODB_HOST || ip.address();
    const port = env.MONGODB_PORT || '27018';
    const database = env.MONGODB_DATABASE || 'bulita';
    const username = env.MONGODB_USERNAME || '';
    const password = env.MONGODB_PASSWORD || '';
    const authSource = env.MONGODB_AUTH_SOURCE || 'admin';

    if (!username || !password) {
        return `mongodb://${host}:${port}/${database}`;
    }

    return `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(
        password,
    )}@${host}:${port}/${database}?authSource=${encodeURIComponent(authSource)}`;
}

export default {
    /** 服务端host, 默认为本机ip地址(可能会是局域网地址) */
    host: env.HOST || ip.address(),

    // service port
    port: env.PORT ? parseInt(env.Port, 10) : 9200,

    // mongodb address
    database: buildMongoDatabaseUrl(),

    redis: {
        host: env.REDIS_HOST || ip.address(),
        port: env.REDIS_PORT ? parseInt(env.REDIS_PORT, 10) : 6380,
        password: env.REDIS_PASSWORD || '',
    },

    // jwt encryption secret
    jwtSecret: env.JWT_SECRET,

    // Google OAuth / GIS client id
    googleClientId: env.GOOGLE_CLIENT_ID || '',

    // Maximize the number of groups
    maxGroupsCount: env.MAX_GROUP_NUM ? parseInt(env.MAX_GROUP_NUM, 10) : 0,

    allowOrigin: env.AllowOrigin ? env.AllowOrigin.split(',') : null,

    // token expires time
    tokenExpiresTime: env.TOKEN_EXPIRES_TIME
        ? parseInt(env.TOKEN_EXPIRES_TIME, 10) * 1000
        : 7 * 1000 * 60 * 60 * 24,

    adminEmails: env.ADMIN_EMAILS ? env.ADMIN_EMAILS.split(',') : [],

    /** 禁用注册功能 */
    disableRegister: false,

    /** Aliyun OSS */
    aliyunOSS: {
        enable: env.ALIYUN_OSS ? env.ALIYUN_OSS === 'true' : false,
        accessKeyId: env.ACCESS_KEY_ID || '',
        accessKeySecret: env.ACCESS_KEY_SECRET || '',
        roleArn: env.ROLE_ARN || '',
        region: env.REGION || '',
        bucket: env.BUCKET || '',
        endpoint: env.ENDPOINT || '',
    },
};
