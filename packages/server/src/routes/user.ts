import bcrypt from 'bcryptjs';
import assert, { AssertionError } from 'assert';
import jwt from 'jwt-simple';
import { Types } from '@bulita/database/mongoose';
import config from '@bulita/config/server';
import getRandomAvatar from '@bulita/utils/getRandomAvatar';
import { SALT_ROUNDS } from '@bulita/utils/const';
import Snowflake from '@bulita/utils/snowflake';
import User, { UserDocument } from '@bulita/database/mongoose/models/user';
import Group, { GroupDocument } from '@bulita/database/mongoose/models/group';
import Friend, {
    FriendDocument,
} from '@bulita/database/mongoose/models/friend';
import Socket from '@bulita/database/mongoose/models/socket';
import Message, {
    handleInviteV2Messages,
} from '@bulita/database/mongoose/models/message';
import Notification from '@bulita/database/mongoose/models/notification';
import {
    DisableRegisterUserSendMessageKey,
    DisableRegisterUserKey,
    getNewRegisteredUserIpKey,
    getNewUserKey,
    Redis,
} from '@bulita/database/redis/initRedis';
import chalk from 'chalk';

const { XMLHttpRequest } = require('xmlhttprequest');

const BOTS = process.env.BOTS ? process.env.BOTS.split(',') : [];
const IP_LOCATION_API = process.env.IP_LOCATION_API;

const { isValid } = Types.ObjectId;

/** 一天时间 */
const OneDay = 1000 * 60 * 60 * 24;

const PASSWORD_REGEX = process.env.PASSWORD_REGEX || '';
const PASSWORD_TIPS = process.env.PASSWORD_TIPS || '';
const pattern = new RegExp(PASSWORD_REGEX);

interface Environment {
    /** 客户端系统 */
    os: string;
    /** 客户端浏览器 */
    browser: string;
    /** 客户端环境信息 */
    environment: string;
}

/**
 * 生成jwt token
 * @param user 用户
 * @param uid
 * @param environment 客户端环境信息
 */
function generateToken(user: string, uid: string, environment: string) {
    return jwt.encode(
        {
            user,
            uid,
            environment,
            exp: Math.floor((Date.now() + config.tokenExpiresTime) / 1000),
        },
        config.jwtSecret,
    );
}

/**
 * 处理注册时间不满24小时的用户
 * @param user 用户
 * @param ip
 */
async function handleNewUser(user: UserDocument, ip = '') {
    // 将用户添加到新用户列表, 24小时后删除
    if (Date.now() - user.createTime.getTime() < OneDay) {
        const userId = user._id.toString();
        await Redis.set(getNewUserKey(userId), userId, Redis.Day);

        if (ip) {
            const registeredCount = await Redis.get(
                getNewRegisteredUserIpKey(ip),
            );
            await Redis.set(
                getNewRegisteredUserIpKey(ip),
                (parseInt(registeredCount || '0', 10) + 1).toString(),
                process.env.REGISTER_IP_INTERVAL,
            );
        }
    }
}

async function getUserNotificationTokens(user: UserDocument) {
    const notifications = (await Notification.find({ user })) || [];
    return notifications.map(({ token }) => token);
}

const charset =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function randomString(len: number) {
    let result = '';
    for (let i = 0; i < len; i++) {
        result += charset[Math.floor(Math.random() * charset.length)];
    }
    return result;
}

async function addDefaultLinkmans(user: UserDocument) {
    // 登录时自动加群和加联系人
    const defaultGroup = await Group.findOne({ isDefault: true });
    if (!defaultGroup) {
        console.log(chalk.red('Default group does not exist'));
        return;
    }
    if (!defaultGroup.creator) {
        defaultGroup.creator = user._id;
    }
    if (user && defaultGroup.members.indexOf(user._id) === -1) {
        defaultGroup.members.push(user._id);
    }
    await defaultGroup.save();

    const defaultLinkmans = process.env.DEFAULT_LINKMANS;

    if (defaultLinkmans) {
        const defaultLinkmansArray = defaultLinkmans.split(',');
        await Promise.all(
            defaultLinkmansArray.map(async (defaultLinkman: UserDocument) => {
                const linkman = await User.findOne({
                    username: defaultLinkman,
                });
                if (!linkman) {
                    console.log(chalk.red(`User [${linkman}] does not exist`));
                } else {
                    const friend = await Friend.find({
                        from: user,
                        to: linkman._id,
                    });
                    if (friend.length === 0) {
                        Friend.create({
                            from: user._id,
                            to: linkman._id,
                        } as FriendDocument);
                    }
                }
            }),
        );
    }
}

/**
 * 注册新用户
 * @param ctx Context
 */
export async function register(
    ctx: Context<{ username: string; password: string } & Environment>,
) {
    const disableRegisterUser = await Redis.get(DisableRegisterUserKey);
    assert(disableRegisterUser !== 'true', '游客登录禁用中');

    let { username, password, os, browser, environment } = ctx.data;

    for (let i = 3; i < 10; i++) {
        username = `${process.env.DEFAULT_USERNAME}${randomString(i)}`;
        const user = await User.findOne({ username });
        if (user) {
            continue;
        }
        break;
    }

    const registeredCountWithin24Hours = await Redis.get(
        getNewRegisteredUserIpKey(ctx.socket.ip),
    );
    assert(
        parseInt(registeredCountWithin24Hours || '0', 10) < 1,
        '您的IP受限, 暂时无法登录',
    );

    let tag = '';
    if (BOTS.includes(username)) {
        tag = 'bot';
    } else if (IP_LOCATION_API) {
        const url = `${IP_LOCATION_API}${ctx.socket.ip.split(',')[0]}`;
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.timeout = 3000;
        xhr.send();
        await new Promise((resolve) => (xhr.onload = resolve)); // 使用 await 等待请求完成
        if (xhr.status === 200) {
            tag = xhr.responseText;
        }
    }
    let newUser = null;
    const snowflake = new Snowflake(1n, 1n, 0n);
    try {
        newUser = await User.create({
            username,
            id: snowflake.nextId().toString(),
            avatar: getRandomAvatar(),
            lastLoginIp: ctx.socket.ip,
            tag: tag,
        } as UserDocument);
    } catch (err) {
        if ((err as Error).name === 'ValidationError') {
            return '用户名包含不支持的字符或者长度超过限制';
        }
        throw err;
    }

    const user = newUser;

    await handleNewUser(newUser, ctx.socket.ip);

    await addDefaultLinkmans(user);

    const defaultGroup = await Group.findOne({ isDefault: true });

    const friends = await Friend.find({ from: user._id }).populate('to', {
        avatar: 1,
        username: 1,
        signature: 1,
        level: 1,
        tag: 1,
    });

    const token = generateToken(
        newUser._id.toString(),
        newUser.id.toString(),
        environment,
    );

    ctx.socket.user = newUser._id.toString();
    await Socket.updateOne(
        { id: ctx.socket.id },
        {
            user: newUser._id,
            os,
            browser,
            environment,
        },
    );

    return {
        _id: newUser._id,
        avatar: newUser.avatar,
        username: newUser.username,
        groups: [
            {
                _id: defaultGroup._id,
                name: defaultGroup.name,
                avatar: defaultGroup.avatar,
                creator: defaultGroup.creator,
                createTime: defaultGroup.createTime,
                messages: [],
            },
        ],
        friends,
        token,
        isAdmin: false,
        notificationTokens: [],
    };
}

/**
 * 账密登录
 * @param ctx Context
 */
export async function login(
    ctx: Context<{ username: string; password: string } & Environment>,
) {
    const { username, password, os, browser, environment } = ctx.data;
    assert(username, '用户名不能为空');
    assert(password, '密码不能为空');

    const user = await User.findOne({ username });
    if (!user) {
        throw new AssertionError({ message: '用户名或密码不正确' });
    }

    const isPasswordCorrect = bcrypt.compareSync(password, user.password);
    assert(isPasswordCorrect, '用户名或密码不正确');

    await handleNewUser(user);

    let tag = '';
    if (BOTS.includes(user.username)) {
        tag = 'bot';
    } else if (IP_LOCATION_API) {
        const url = `${IP_LOCATION_API}${ctx.socket.ip.split(',')[0]}`;
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.timeout = 3000;
        xhr.send();
        try {
            await new Promise((resolve) => (xhr.onload = resolve)); // 使用 await 等待请求完成
            if (xhr.status === 200) {
                tag = xhr.responseText;
            }
        } catch (error) {
            console.log(error);
        }
    }
    user.lastLoginTime = new Date();
    user.lastLoginIp = ctx.socket.ip;
    user.tag = tag;
    await user.save();

    await addDefaultLinkmans(user);

    const groups = await Group.find(
        { members: user._id },
        {
            _id: 1,
            name: 1,
            avatar: 1,
            creator: 1,
            createTime: 1,
        },
    );
    groups.forEach((group) => {
        ctx.socket.join(group._id.toString());
    });

    const token = generateToken(
        user._id.toString(),
        user.id.toString(),
        environment,
    );

    ctx.socket.user = user._id.toString();
    await Socket.updateOne(
        { id: ctx.socket.id },
        {
            user: user._id,
            os,
            browser,
            environment,
        },
    );

    const notificationTokens = await getUserNotificationTokens(user);

    const friends = await Friend.find({ from: user._id }).populate('to', {
        avatar: 1,
        username: 1,
        signature: 1,
        level: 1,
        tag: 1,
    });

    return {
        _id: user._id,
        avatar: user.avatar,
        username: user.username,
        email: user.email,
        level: user.level,
        signature: user.signature,
        tag: user.tag,
        groups,
        friends,
        token,
        isAdmin: config.administrators.includes(user.username),
        notificationTokens,
    };
}

/**
 * token登录
 * @param ctx Context
 */
export async function loginByToken(
    ctx: Context<{ token: string } & Environment>,
) {
    const { token, os, browser, environment } = ctx.data;

    assert(token, 'token不能为空');

    let payload = null;
    try {
        payload = jwt.decode(token, config.jwtSecret);
    } catch (err) {
        return '非法token';
    }

    // assert(Date.now() < payload.expires, 'token已过期');
    // assert.equal(environment, payload.environment, '非法登录');

    assert(Date.now() < payload.exp * 1000, '请重新登录');

    const user = await User.findOne(
        // { _id: payload.user },
        { id: payload.uid },
        {
            _id: 1,
            avatar: 1,
            username: 1,
            email: 1,
            level: 1,
            signature: 1,
            tag: 1,
            createTime: 1,
        },
    );
    if (!user) {
        throw new AssertionError({ message: '您的身份已过期 请重新登录' });
    }

    await handleNewUser(user);

    let tag = '';
    if (BOTS.includes(user.username)) {
        tag = 'bot';
    } else if (IP_LOCATION_API) {
        const url = `${IP_LOCATION_API}${ctx.socket.ip.split(',')[0]}`;
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.timeout = 3000;
        xhr.send();
        try {
            await new Promise((resolve) => (xhr.onload = resolve)); // 使用 await 等待请求完成
            if (xhr.status === 200) {
                tag = xhr.responseText;
            }
        } catch (error) {
            console.log(error);
        }
    }
    user.lastLoginTime = new Date();
    user.lastLoginIp = ctx.socket.ip;
    user.tag = tag;
    await user.save();

    await addDefaultLinkmans(user);

    const groups = await Group.find(
        { members: user._id },
        {
            _id: 1,
            name: 1,
            avatar: 1,
            creator: 1,
            createTime: 1,
        },
    );
    groups.forEach((group: GroupDocument) => {
        ctx.socket.join(group._id.toString());
    });

    const friends = await Friend.find({ from: user._id }).populate('to', {
        avatar: 1,
        username: 1,
        signature: 1,
        level: 1,
        tag: 1,
    });

    ctx.socket.user = user._id.toString();
    await Socket.updateOne(
        { id: ctx.socket.id },
        {
            user: user._id,
            os,
            browser,
            environment,
        },
    );

    const notificationTokens = await getUserNotificationTokens(user);

    return {
        _id: user._id,
        avatar: user.avatar,
        username: user.username,
        email: user.email,
        level: user.level,
        signature: user.signature,
        tag: user.tag,
        groups,
        friends,
        isAdmin: config.administrators.includes(user.username),
        notificationTokens,
    };
}

/**
 * 游客登录, 只能获取默认群组信息
 * @param ctx Context
 */
export async function guest(ctx: Context<Environment>) {
    const { os, browser, environment } = ctx.data;

    await Socket.updateOne(
        { id: ctx.socket.id },
        {
            os,
            browser,
            environment,
        },
    );

    const group = await Group.findOne(
        { isDefault: true },
        {
            _id: 1,
            name: 1,
            avatar: 1,
            createTime: 1,
            creator: 1,
        },
    );
    if (!group) {
        throw new AssertionError({ message: '默认群组不存在' });
    }
    ctx.socket.join(group._id.toString());

    const messages = await Message.find(
        { to: group._id },
        {
            type: 1,
            content: 1,
            from: 1,
            createTime: 1,
            deleted: 1,
        },
        { sort: { createTime: -1 }, limit: 15 },
    ).populate('from', { username: 1, avatar: 1, tag: 1 });
    await handleInviteV2Messages(messages);
    messages.reverse();

    return { messages, ...group.toObject() };
}

/**
 * 修改用户头像
 * @param ctx Context
 */
export async function changeAvatar(ctx: Context<{ avatar: string }>) {
    const { avatar } = ctx.data;
    assert(avatar, '新头像链接不能为空');

    await User.updateOne(
        { _id: ctx.socket.user },
        {
            avatar,
        },
    );

    return {};
}

/**
 * 添加好友, 单向添加
 * @param ctx Context
 */
export async function addFriend(ctx: Context<{ userId: string }>) {
    const { userId } = ctx.data;
    assert(isValid(userId), '无效的用户ID');
    // assert(ctx.socket.user !== userId, '不能添加自己为好友');

    const user = await User.findOne({ _id: userId });
    if (!user) {
        throw new AssertionError({ message: '添加好友失败, 用户不存在' });
    }

    const friend = await Friend.find({ from: ctx.socket.user, to: user._id });

    assert(friend.length === 0, '你们已经是好友了 刷新下试试');

    const newFriend = await Friend.create({
        from: ctx.socket.user as string,
        to: user._id,
    } as FriendDocument);

    return {
        _id: user._id,
        username: user.username,
        avatar: user.avatar,
        signature: user.signature,
        tag: user.tag,
        level: user.level,
        from: newFriend.from,
        to: newFriend.to,
    };
}

/**
 * 删除好友, 单向删除
 * @param ctx Context
 */
export async function deleteFriend(ctx: Context<{ userId: string }>) {
    const { userId } = ctx.data;
    assert(isValid(userId), '无效的用户ID');

    const user = await User.findOne({ _id: userId });
    if (!user) {
        throw new AssertionError({ message: '用户不存在' });
    }

    await Friend.deleteOne({ from: ctx.socket.user, to: user._id });
    return {};
}

/**
 * 修改用户密码
 * @param ctx Context
 */
export async function changePassword(
    ctx: Context<{ oldPassword: string; newPassword: string }>,
) {
    const { oldPassword, newPassword } = ctx.data;
    assert(newPassword, '新密码不能为空');
    assert(oldPassword === newPassword, '两次密码输入不一致');
    if (PASSWORD_REGEX) {
        assert(pattern.test(newPassword), PASSWORD_TIPS);
    }
    const user = await User.findOne({ _id: ctx.socket.user });
    if (!user) {
        throw new AssertionError({ message: '用户不存在' });
    }

    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hash = await bcrypt.hash(newPassword, salt);

    user.salt = salt;
    user.password = hash;
    await user.save();

    return {
        msg: 'ok',
    };
}

/**
 * 修改用户名
 * @param ctx Context
 */
export async function changeUsername(ctx: Context<{ username: string }>) {
    const self = await User.findOne({ _id: ctx.socket.user });
    if (!self) {
        throw new AssertionError({ message: '用户不存在' });
    }
    if (!self.password) {
        throw new AssertionError({ message:'请先设置密码'});
    }
    const { username } = ctx.data;
    assert(username, '新用户名不能为空');

    const user = await User.findOne({ username });
    assert(!user, '该用户名已存在, 换一个试试吧');

    self.username = username;
    await self.save();

    return {
        msg: 'ok',
    };
}

/**
 * 修改个性签名
 * @param ctx Context
 */
export async function changeSignature(ctx: Context<{ signature: string }>) {
    const { signature } = ctx.data;

    const self = await User.findOne({ _id: ctx.socket.user });
    if (!self) {
        throw new AssertionError({ message: '用户不存在' });
    }

    self.signature = signature;
    await self.save();

    return {
        msg: 'ok',
    };
}

/**
 * 重置用户密码, 需要管理员权限
 * @param ctx Context
 */
export async function resetUserPassword(ctx: Context<{ username: string }>) {
    const { username } = ctx.data;
    assert(username !== '', 'username不能为空');

    const user = await User.findOne({ username });
    if (!user) {
        throw new AssertionError({ message: '用户不存在' });
    }

    const newPassword = process.env.DEFAULT_PASSWORD;
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hash = await bcrypt.hash(newPassword, salt);

    user.salt = salt;
    user.password = hash;
    await user.save();

    return {
        newPassword,
    };
}

/**
 * 更新用户标签, 需要管理员权限
 * @param ctx Context
 */
export async function setUserTag(
    ctx: Context<{ username: string; tag: string }>,
) {
    const { username, tag } = ctx.data;
    assert(username !== '', 'username不能为空');
    // assert(tag !== '', 'tag不能为空');
    // assert(
    //     /^([0-9a-zA-Z]{1,2}|[\u4e00-\u9eff]){1,5}$/.test(tag),
    //     '标签不符合要求, 允许5个汉字或者10个字母',
    // );

    const user = await User.findOne({ username });
    if (!user) {
        throw new AssertionError({ message: '用户不存在' });
    }

    user.tag = tag;
    await user.save();

    const sockets = await Socket.find({ user: user._id });
    const socketIdList = sockets.map((socket) => socket.id);
    if (socketIdList.length) {
        ctx.socket.emit(socketIdList, 'changeTag', user.tag);
    }

    return {
        msg: 'ok',
    };
}

/**
 * 获取指定在线用户 ip
 */
export async function getUserIps(
    ctx: Context<{ userId: string }>,
): Promise<string[]> {
    const { userId } = ctx.data;
    assert(userId, 'userId不能为空');
    assert(isValid(userId), '不合法的userId');

    const sockets = await Socket.find({ user: userId });
    const ipList = sockets.map((socket) => socket.ip) || [];
    return Array.from(new Set(ipList));
}

const UserOnlineStatusCacheExpireTime = 1000 * 60;
function getUserOnlineStatusWrapper() {
    const cache: Record<
        string,
        {
            value: boolean;
            expireTime: number;
        }
    > = {};
    return async function getUserOnlineStatus(
        ctx: Context<{ userId: string }>,
    ) {
        const { userId } = ctx.data;
        assert(userId, 'userId不能为空');
        assert(isValid(userId), '不合法的userId');

        if (cache[userId] && cache[userId].expireTime > Date.now()) {
            return {
                isOnline: cache[userId].value,
            };
        }

        const sockets = await Socket.find({ user: userId });
        const isOnline = sockets.length > 0;
        cache[userId] = {
            value: isOnline,
            expireTime: Date.now() + UserOnlineStatusCacheExpireTime,
        };
        return {
            isOnline,
        };
    };
}
export const getUserOnlineStatus = getUserOnlineStatusWrapper();
