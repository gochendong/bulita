import config from '@bulita/config/server';
import getRandomAvatar from '@bulita/utils/getRandomAvatar';
import { doctor } from '@bulita/bin/scripts/doctor';
import logger from '@bulita/utils/logger';
import initMongoDB from '@bulita/database/mongoose/initMongoDB';
import Socket from '@bulita/database/mongoose/models/socket';
import Group, { GroupDocument } from '@bulita/database/mongoose/models/group';
import User, { UserDocument } from '@bulita/database/mongoose/models/user';
import bcrypt from 'bcryptjs';
import { SALT_ROUNDS } from '@bulita/utils/const';
import Snowflake from '@bulita/utils/snowflake';
import app from './app';

(async () => {
    if (process.argv.find((argv) => argv === '--doctor')) {
        await doctor();
    }

    await initMongoDB();

    // 判断管理员是否存在, 不存在就创建
    const admins = process.env.ADMINS;
    const adminsArray = [];
    let originalAdmin = null;
    const snowflake = new Snowflake(1n, 1n, 0n);
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hash = await bcrypt.hash(
        process.env.DEFAULT_PASSWORD,
        salt,
    );
    if (admins) {
        const defaultAdminsArray = admins.split(',');
        for (let i = 0; i < defaultAdminsArray.length; i++) {
            const defaultAdmin = defaultAdminsArray[i];
            let admin = await User.findOne({ username: defaultAdmin });
            if (!admin) {
                admin = await User.create({
                    username: defaultAdmin,
                    id: snowflake.nextId().toString(),
                    avatar: getRandomAvatar(),
                    salt,
                    password: hash,
                } as UserDocument);
                if (!admin) {
                    logger.error(
                        '[admin]',
                        `create admin ${defaultAdmin} fail`,
                    );
                    return process.exit(1);
                }
                if (!originalAdmin) {
                    originalAdmin = admin;
                }
            }
            adminsArray.push(admin._id);
        }
    }

    process.env.ADMINS_ARRAY = adminsArray.join(',');

    // 判断默认群是否存在, 不存在就创建
    const group = await Group.findOne({ isDefault: true });
    if (!group) {
        if (!originalAdmin) {
            logger.error('[defaultGroup]', 'create admin first');
            return process.exit(1);
        }
        const defaultGroup = await Group.create({
            name: process.env.DEFAULT_GROUP_NAME,
            avatar: getRandomAvatar(),
            isDefault: true,
            creator: originalAdmin._id,
        } as GroupDocument);
        if (!defaultGroup) {
            logger.error('[defaultGroup]', 'create default group fail');
            return process.exit(1);
        }
    }

    // 判断机器人账号是否存在, 不存在就创建
    const defaultBots = process.env.BOTS;
    if (defaultBots) {
        const defaultBotsArray = defaultBots.split(',');
        await Promise.all(
            defaultBotsArray.map(async (defaultBot: string) => {
                let bot = await User.findOne({ username: defaultBot });
                if (!bot) {
                    bot = await User.create({
                        username: defaultBot,
                        id: snowflake.nextId().toString(),
                        avatar: getRandomAvatar(),
                        salt,
                        password: hash,
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
