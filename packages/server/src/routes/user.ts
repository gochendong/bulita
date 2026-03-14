import bcrypt from 'bcryptjs';
import axios from 'axios';
import assert, { AssertionError } from 'assert';
import jwt from 'jwt-simple';
import { Types } from '@bulita/database/mongoose';
import config from '@bulita/config/server';
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
    getNewRegisteredUserIpKey,
    getNewUserKey,
    Redis,
} from '@bulita/database/redis/initRedis';
import { getConfigWithDefault } from '../utils/runtimeConfig';
import chalk from 'chalk';

const { XMLHttpRequest } = require('xmlhttprequest');
const {IP_LOCATION_API} = process.env;

const { isValid } = Types.ObjectId;

/** 一天时间 */
const OneDay = 1000 * 60 * 60 * 24;

interface Environment {
    /** 客户端系统 */
    os: string;
    /** 客户端浏览器 */
    browser: string;
    /** 客户端环境信息 */
    environment: string;
}

interface GoogleTokenInfo {
    aud: string;
    email?: string;
    email_verified?: string | boolean;
    name?: string;
    picture?: string;
    sub: string;
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
            const registerIpInterval = await getConfigWithDefault('REGISTER_IP_INTERVAL');
            const registeredCount = await Redis.get(
                getNewRegisteredUserIpKey(ip),
            );
            await Redis.set(
                getNewRegisteredUserIpKey(ip),
                (parseInt(registeredCount || '0', 10) + 1).toString(),
                registerIpInterval,
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

    const defaultLinkmans = await getConfigWithDefault('DEFAULT_LINKMANS');

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

function getGoogleOnlyMessage() {
    return '当前仅支持 Google 登录';
}

function isConfiguredAdmin(user: Pick<UserDocument, 'username' | 'email'>) {
    const adminEmails = config.adminEmails.map((email) => email.trim()).filter(Boolean);
    return !!user.email && adminEmails.includes(user.email);
}

async function resolveUserTag(username: string, ip: string) {
    let tag = '';
    const botsList = (await getConfigWithDefault('BOTS'))
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
    if (botsList.includes(username)) {
        tag = 'bot';
    } else if (IP_LOCATION_API) {
        const url = `${IP_LOCATION_API}${ip.split(',')[0]}`;
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.timeout = 3000;
        xhr.send();
        try {
            await new Promise((resolve) => (xhr.onload = resolve));
            if (xhr.status === 200) {
                tag = xhr.responseText;
            }
        } catch (error) {
            console.log(error);
        }
    }
    return tag;
}

async function getLoginPayload(
    user: UserDocument,
    ctx: Context<Environment>,
    includeToken: boolean,
) {
    const { os, browser, environment } = ctx.data;

    await handleNewUser(user);

    user.lastLoginTime = new Date();
    user.lastLoginIp = ctx.socket.ip;
    user.tag = await resolveUserTag(user.username, ctx.socket.ip);
    await user.save();

    const groups = await Group.find(
        { members: user._id },
        {
            _id: 1,
            name: 1,
            avatar: 1,
            announcement: 1,
            creator: 1,
            createTime: 1,
            members: 1,
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
        createTime: 1,
    });

    const isAdmin = isConfiguredAdmin(user);
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
    const socket = (ctx.socket as any).__socket;
    if (socket) {
        socket.data.isAdmin = isAdmin;
    }

    let bot = null;
    const defaultBotName = await getConfigWithDefault('DEFAULT_BOT_NAME');
    if (defaultBotName) {
        bot = await User.findOne(
            { username: defaultBotName },
            {
                _id: 1,
                username: 1,
                avatar: 1,
                tag: 1,
                level: 1,
                signature: 1,
            },
        );
    }

    const notificationTokens = await getUserNotificationTokens(user);

    return {
        _id: user._id,
        avatar: user.avatar,
        username: user.username,
        email: user.email,
        level: user.level,
        signature: user.signature,
        pushToken: user.pushToken,
        tag: user.tag,
        createTime: user.createTime,
        groups: groups.map((g: GroupDocument) => ({
            _id: g._id,
            name: g.name,
            avatar: g.avatar,
            announcement: g.announcement,
            creator: g.creator,
            createTime: g.createTime,
            membersCount: g.members.length,
        })),
        friends,
        bot,
        isAdmin,
        notificationTokens,
        ...(includeToken
            ? {
                  token: generateToken(
                      user._id.toString(),
                      user.id.toString(),
                      environment,
                  ),
              }
            : {}),
    };
}

function normalizeUsernameCandidate(value: string) {
    return value.trim().replace(/\s+/g, ' ').slice(0, 20);
}

async function generateUniqueUsername(baseName: string) {
    const defaultUsername = await getConfigWithDefault('DEFAULT_USERNAME');
    const normalizedBase =
        normalizeUsernameCandidate(baseName) || defaultUsername || 'Google用户';

    let username = normalizedBase;
    for (let i = 0; i < 10; i += 1) {
        const existed = await User.findOne({ username });
        if (!existed) {
            return username;
        }
        const suffix = randomString(4);
        username = `${normalizedBase.slice(0, 20 - suffix.length)}${suffix}`;
    }

    return `${(defaultUsername || 'Google用户').slice(0, 16)}${randomString(4)}`;
}

function getGoogleDisplayName(tokenInfo: GoogleTokenInfo) {
    const emailPrefix = tokenInfo.email?.split('@')[0] || '';
    return normalizeUsernameCandidate(tokenInfo.name || emailPrefix);
}

async function syncGoogleProfile(user: UserDocument, tokenInfo: GoogleTokenInfo) {
    const displayName = getGoogleDisplayName(tokenInfo);
    if (displayName && displayName !== user.username) {
        const sameNameUser = await User.findOne({ username: displayName });
        if (!sameNameUser || sameNameUser._id.toString() === user._id.toString()) {
            user.username = displayName;
        }
    }

    user.email = tokenInfo.email || user.email;
    user.avatar = tokenInfo.picture || '';
    if (!user.googleId) {
        user.googleId = tokenInfo.sub;
    }
}

async function verifyGoogleCredential(credential: string) {
    assert(credential, 'Google 登录凭证不能为空');
    assert(config.googleClientId, '服务端未配置 GOOGLE_CLIENT_ID');

    try {
        const response = await axios.get<GoogleTokenInfo>(
            'https://oauth2.googleapis.com/tokeninfo',
            {
                params: { id_token: credential },
                timeout: 5000,
            },
        );
        const tokenInfo = response.data;
        assert(tokenInfo?.sub, 'Google 登录凭证无效');
        assert(
            tokenInfo.aud === config.googleClientId,
            'Google 登录凭证不匹配当前站点',
        );
        assert(
            tokenInfo.email_verified === true ||
                tokenInfo.email_verified === 'true',
            'Google 邮箱未验证',
        );
        return tokenInfo;
    } catch (error) {
        if (error instanceof AssertionError) {
            throw error;
        }
        throw new AssertionError({ message: 'Google 登录校验失败' });
    }
}

/**
 * 注册新用户
 * @param ctx Context
 */
export async function register(
    _ctx: Context<{ username: string; password: string } & Environment>,
) {
    throw new AssertionError({ message: getGoogleOnlyMessage() });
}

/**
 * 账密登录
 * @param ctx Context
 */
export async function login(
    _ctx: Context<{ username: string; password: string } & Environment>,
) {
    throw new AssertionError({ message: getGoogleOnlyMessage() });
}

export async function googleLogin(
    ctx: Context<{ credential: string } & Environment>,
) {
    const { credential } = ctx.data;
    const tokenInfo = await verifyGoogleCredential(credential);

    let user = await User.findOne({ googleId: tokenInfo.sub });
    if (!user && tokenInfo.email) {
        const bindCandidate = await User.findOne({ email: tokenInfo.email });
        if (bindCandidate && !bindCandidate.googleId) {
            await syncGoogleProfile(bindCandidate, tokenInfo);
            user = await bindCandidate.save();
        }
    }

    if (!user) {
        const registeredCountWithin24Hours = await Redis.get(
            getNewRegisteredUserIpKey(ctx.socket.ip),
        );
        assert(
            parseInt(registeredCountWithin24Hours || '0', 10) < 1,
            '您的IP受限, 暂时无法登录',
        );

        const username = await generateUniqueUsername(
            tokenInfo.name || tokenInfo.email || '',
        );
        const snowflake = new Snowflake(1n, 1n, 0n);
        user = await User.create({
            username,
            id: snowflake.nextId().toString(),
            avatar: tokenInfo.picture || '',
            email: tokenInfo.email || '',
            googleId: tokenInfo.sub,
            lastLoginIp: ctx.socket.ip,
        } as UserDocument);
        await handleNewUser(user, ctx.socket.ip);
        await addDefaultLinkmans(user);
    } else {
        await syncGoogleProfile(user, tokenInfo);
        await user.save();
    }

    return getLoginPayload(user, ctx, true);
}

/**
 * token登录
 * @param ctx Context
 */
export async function loginByToken(
    ctx: Context<{ token: string } & Environment>,
) {
    const { token } = ctx.data;

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
            pushToken: 1,
            tag: 1,
            createTime: 1,
        },
    );
    if (!user) {
        throw new AssertionError({ message: '您的身份已过期 请重新登录' });
    }

    return getLoginPayload(user as UserDocument, ctx, false);
}

/**
 * 游客登录, 只能获取默认群组信息
 * @param ctx Context
 */
export async function guest(_ctx: Context<Environment>) {
    const { os, browser, environment } = _ctx.data;

    await Socket.updateOne(
        { id: _ctx.socket.id },
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
            announcement: 1,
            createTime: 1,
            creator: 1,
            members: 1,
        },
    );
    if (!group) {
        throw new AssertionError({ message: '默认群组不存在' });
    }
    _ctx.socket.join(group._id.toString());

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

    return { messages, ...group.toObject(), membersCount: group.members.length };
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
    const passwordRegex = await getConfigWithDefault('PASSWORD_REGEX');
    const passwordTips = await getConfigWithDefault('PASSWORD_TIPS');
    if (passwordRegex) {
        const pattern = new RegExp(passwordRegex);
        assert(pattern.test(newPassword), passwordTips);
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
    // if (!self.password) {
    //     throw new AssertionError({ message:'请先设置密码'});
    // }
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
 * 修改私聊通知token
 * @param ctx Context
 */
export async function changePushToken(ctx: Context<{ pushToken: string }>) {
    const { pushToken } = ctx.data;

    const self = await User.findOne({ _id: ctx.socket.user });
    if (!self) {
        throw new AssertionError({ message: '用户不存在' });
    }

    self.pushToken = pushToken;
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

    const newPassword = await getConfigWithDefault('DEFAULT_PASSWORD');
    assert(newPassword, '默认密码未配置，请在管理台设置 DEFAULT_PASSWORD');
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
            isOnline: boolean;
            lastLoginTime: string | null;
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
                isOnline: cache[userId].isOnline,
                lastLoginTime: cache[userId].lastLoginTime,
            };
        }

        const sockets = await Socket.find({ user: userId });
        const isOnline = sockets.length > 0;
        let lastLoginTime: string | null = null;
        if (!isOnline) {
            const user = await User.findOne(
                { _id: userId },
                { lastLoginTime: 1 },
            );
            lastLoginTime = user?.lastLoginTime
                ? (user.lastLoginTime as Date).toISOString()
                : null;
        }

        // 缓存结果
        cache[userId] = {
            isOnline,
            lastLoginTime,
            expireTime: Date.now() + UserOnlineStatusCacheExpireTime,
        };

        return {
            isOnline,
            lastLoginTime,
        };
    };
}
export const getUserOnlineStatus = getUserOnlineStatusWrapper();

/**
 * 管理员按用户名查找用户（用于删除前校验）, 需要管理员权限
 * @param ctx Context
 */
export async function getAdminUserByUsername(
    ctx: Context<{ username: string }>,
) {
    const { username } = ctx.data;
    assert(username, '用户名不能为空');
    const name = (username as string).trim();
    if (!name) {
        return { exists: false };
    }
    const user = await User.findOne({ username: name });
    return user
        ? { exists: true, username: user.username, _id: user._id.toString() }
        : { exists: false };
}

/**
 * 删除用户, 需要管理员权限
 * @param ctx Context
 */
export async function deleteUser(ctx: Context<{ username: string }>) {
    const { username } = ctx.data;
    assert(username, '用户名不能为空');

    const user = await User.findOne({ username });
    if (!user) {
        throw new AssertionError({ message: '用户不存在' });
    }

    assert(
        !isConfiguredAdmin(user),
        '不能删除管理员账号',
    );

    const userId = user._id;

    // 断开 Socket 连接
    const sockets = await Socket.find({ user: userId });
    const io = (ctx.socket as any).__socket.server;
    sockets.forEach((socketRecord) => {
        const connectedSocket = io.sockets.sockets.get(socketRecord.id);
        if (connectedSocket) {
            connectedSocket.emit('deleteUser', '您的账号已被删除');
            connectedSocket.disconnect(true);
        }
    });
    await Socket.deleteMany({ user: userId });

    // 处理创建的群组：转让给系统用户
    const systemUser = await User.findOne({ tag: 'system' });
    if (systemUser) {
        await Group.updateMany({ creator: userId }, { creator: systemUser._id });
    }

    // 删除用户
    await User.deleteOne({ _id: userId });

    // 删除好友关系
    await Friend.deleteMany({ $or: [{ from: userId }, { to: userId }] });

    // 退出所有群组
    await Group.updateMany({}, { $pull: { members: userId } });

    // 删除发送的消息
    await Message.deleteMany({ $or: [{ from: userId }, { to: userId }] });

    // 删除通知
    await Notification.deleteMany({ user: userId });

    return {
        msg: 'ok',
    };
}
