import ip from 'ip';

const { env } = process;

export default {
    /** 服务端host, 默认为本机ip地址(可能会是局域网地址) */
    host: env.HOST || ip.address(),

    // service port
    port: env.PORT ? parseInt(env.Port, 10) : 9200,

    // mongodb address
    database: `mongodb://${env.MONGODB_HOST}:${env.MONGODB_PORT}/bulita`,

    redis: {
        host: env.REDIS_HOST || ip.address(),
        port: env.REDIS_PORT ? parseInt(env.REDIS_PORT, 10) : 6379,
    },

    // jwt encryption secret
    jwtSecret: env.JWT_SECRET,

    // Maximize the number of groups
    maxGroupsCount: env.MAX_GROUP_NUM ? parseInt(env.MAX_GROUP_NUM, 10) : 0,

    allowOrigin: env.AllowOrigin ? env.AllowOrigin.split(',') : null,

    // token expires time
    tokenExpiresTime: env.TOKEN_EXPIRES_TIME
        ? parseInt(env.TOKEN_EXPIRES_TIME, 10) * 1000
        : 7 * 1000 * 60 * 60 * 24,

    administrators: env.ADMINS ? env.ADMINS?.split(',') : [],

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
