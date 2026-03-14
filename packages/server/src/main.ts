import config from '@bulita/config/server';
import getRandomAvatar from '@bulita/utils/getRandomAvatar';
import { doctor } from '@bulita/bin/scripts/doctor';
import logger from '@bulita/utils/logger';
import initMongoDB from '@bulita/database/mongoose/initMongoDB';
import Socket from '@bulita/database/mongoose/models/socket';
import Group, { GroupDocument } from '@bulita/database/mongoose/models/group';
import User, { UserDocument } from '@bulita/database/mongoose/models/user';
import Snowflake from '@bulita/utils/snowflake';
import { getConfigWithDefault } from './utils/runtimeConfig';
import app from './app';

(async () => {
    if (process.argv.find((argv) => argv === '--doctor')) {
        await doctor();
    }

    await initMongoDB();

    function normalizeEmailUsername(email: string) {
        const prefix = (email.split('@')[0] || '').replace(/[^0-9a-zA-Z\u4e00-\u9eff]/g, '');
        return (prefix || '管理员').slice(0, 20);
    }

    async function generateBootstrapUsername(baseName: string) {
        const normalizedBase = normalizeEmailUsername(baseName) || '管理员';
        let username = normalizedBase;

        for (let i = 0; i < 10; i += 1) {
            const existed = await User.findOne({ username });
            if (!existed) {
                return username;
            }
            username = `${normalizedBase.slice(0, 16)}${Math.random().toString(36).slice(2, 6)}`;
        }

        return `管理员${Math.random().toString(36).slice(2, 6)}`;
    }

    // 预创建管理员邮箱账号
    const snowflake = new Snowflake(1n, 1n, 0n);
    let defaultGroupCreator: UserDocument | null = null;
    const adminEmails = config.adminEmails.map((email) => email.trim()).filter(Boolean);
    if (adminEmails.length === 0) {
        logger.error('[admin]', 'ADMIN_EMAILS is required');
        return process.exit(1);
    }
    for (let i = 0; i < adminEmails.length; i += 1) {
        const adminEmail = adminEmails[i];
        let admin = await User.findOne({ email: adminEmail });
        if (!admin) {
            const username = await generateBootstrapUsername(adminEmail);
            admin = await User.create({
                username,
                email: adminEmail,
                id: snowflake.nextId().toString(),
                avatar: '',
            } as UserDocument);
        }
        if (!admin) {
            logger.error('[admin]', `create admin email ${adminEmail} fail`);
            return process.exit(1);
        }
        if (!defaultGroupCreator) {
            defaultGroupCreator = admin;
        }
    }

    // 判断默认群是否存在, 不存在就创建
    const group = await Group.findOne({ isDefault: true });
    if (!group) {
        if (!defaultGroupCreator) {
            logger.error('[defaultGroup]', 'create default group creator fail');
            return process.exit(1);
        }
        const defaultGroupName = await getConfigWithDefault('DEFAULT_GROUP_NAME');
        const defaultGroup = await Group.create({
            name: defaultGroupName,
            avatar: getRandomAvatar(),
            isDefault: true,
            creator: defaultGroupCreator._id,
        } as GroupDocument);
        if (!defaultGroup) {
            logger.error('[defaultGroup]', 'create default group fail');
            return process.exit(1);
        }
    }

    // 判断机器人账号是否存在, 不存在就创建（BOTS 仅启动时读取，改后需重启）
    const defaultBots = await getConfigWithDefault('BOTS');
    if (defaultBots) {
        const defaultBotsArray = defaultBots.split(',').map((s) => s.trim()).filter(Boolean);
        await Promise.all(
            defaultBotsArray.map(async (defaultBot: string) => {
                let bot = await User.findOne({ username: defaultBot });
                if (!bot) {
                    bot = await User.create({
                        username: defaultBot,
                        id: snowflake.nextId().toString(),
                        avatar: getRandomAvatar(),
                        tag: 'bot',
                    } as UserDocument)
                    if (!bot) {
                        logger.error('[bot]', `create bot ${defaultBot} fail`);
                        return process.exit(1);
                    }
                }
            }),
        );
    }

    app.listen(config.port, async () => {
        await Socket.deleteMany({}); // 删除Socket表所有历史数据
        logger.info(`>>> server listen on http://localhost:${config.port}`);
    });

    return null;
})();
