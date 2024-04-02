/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import assert, { AssertionError } from 'assert';
import { Types } from '@bulita/database/mongoose';
import { Expo, ExpoPushErrorTicket } from 'expo-server-sdk';

import xss from '@bulita/utils/xss';
import logger from '@bulita/utils/logger';
import User, { UserDocument } from '@bulita/database/mongoose/models/user';
import Group, { GroupDocument } from '@bulita/database/mongoose/models/group';
import Message, {
    handleInviteV2Message,
    handleInviteV2Messages,
    MessageDocument,
} from '@bulita/database/mongoose/models/message';
import Notification from '@bulita/database/mongoose/models/notification';
import History, {
    createOrUpdateHistory,
} from '@bulita/database/mongoose/models/history';
import Socket from '@bulita/database/mongoose/models/socket';

import {
    DisableSendMessageKey,
    DisableNewUserSendMessageKey,
    Redis,
    DisableRegisterUserSendMessageKey,
} from '@bulita/database/redis/initRedis';
import Friend, {
    FriendDocument,
} from '@bulita/database/mongoose/models/friend';
import client from '../../../config/client';
import config from '@bulita/config/server';

const { isValid } = Types.ObjectId;

/** 初次获取历史消息数 */
const FirstTimeMessagesCount = 60;
/** 每次调用接口获取的历史消息数 */
const EachFetchMessagesCount = 30;

const OneYear = 365 * 24 * 3600 * 1000;
const ThreeDay = 3 * 24 * 3600 * 1000;

/** 石头剪刀布, 用于随机生成结果 */
const RPS = ['石头', '剪刀', '布'];

const { XMLHttpRequest } = require('xmlhttprequest');

async function pushNotification(
    notificationTokens: string[],
    message: MessageDocument,
    groupName?: string,
) {
    if (groupName) {
        return;
    }
    const expo = new Expo({});

    const content =
        message.type === 'text' ? message.content : `[${message.type}]`;
    const pushMessages = notificationTokens.map((notificationToken) => ({
        to: notificationToken,
        sound: 'default',
        title: groupName || (message.from as any).username,
        body: groupName
            ? `${(message.from as any).username}: ${content}`
            : content,
        data: { focus: message.to },
    }));

    const chunks = expo.chunkPushNotifications(pushMessages as any);
    for (const chunk of chunks) {
        try {
            const results = await expo.sendPushNotificationsAsync(chunk);
            results.forEach((result) => {
                const { status, message: errMessage } =
                    result as ExpoPushErrorTicket;
                if (status === 'error') {
                    logger.warn('[Notification]', errMessage);
                }
            });
        } catch (error) {
            logger.error('[Notification]', (error as Error).message);
        }
    }
}

/**
 * 发送消息
 * 如果是发送给群组, to是群组id
 * 如果是发送给个人, to是俩人id按大小序拼接后的值
 * @param ctx Context
 */
export async function sendMessage(ctx: Context<SendMessageData>) {
    const { to, content } = ctx.data;
    let { type } = ctx.data;
    assert(to, 'to不能为空');
    let toGroup: GroupDocument | null = null;
    let toUser: UserDocument | null = null;
    if (isValid(to)) {
        toGroup = await Group.findOne({ _id: to });
        assert(toGroup, '群组不存在');
    } else {
        const userId = to.replace(ctx.socket.user.toString(), '');
        assert(isValid(userId), '无效的用户ID');
        toUser = await User.findOne({ _id: userId });
        assert(toUser, '用户不存在');
    }

    if (
        toGroup ||
        (toUser &&
            toUser.tag !== 'bot' &&
            !config.administrators.includes(toUser.username))
    ) {
        const disableSendMessage = await Redis.get(DisableSendMessageKey);
        assert(
            disableSendMessage !== 'true' || ctx.socket.isAdmin,
            '全员禁言中',
        );

        const disableNewUserSendMessage = await Redis.get(
            DisableNewUserSendMessageKey,
        );
        if (disableNewUserSendMessage === 'true') {
            const user = await User.findById(ctx.socket.user);
            const isNewUser =
                user && user.createTime.getTime() > Date.now() - ThreeDay;
            assert(ctx.socket.isAdmin || !isNewUser, '新用户禁言中');
        }
        const disableNoRegisterUserSendMessage = await Redis.get(
            DisableRegisterUserSendMessageKey,
        );
        if (disableNoRegisterUserSendMessage === 'true') {
            const user = await User.findById(ctx.socket.user);
            const isRegisterUser = user && user.email;
            assert(
                ctx.socket.isAdmin || isRegisterUser,
                `${process.env.DEFAULT_USERNAME}禁言中`,
            );
        }
    }

    const user = await User.findOne(
        { _id: ctx.socket.user },
        {
            username: 1,
            avatar: 1,
            tag: 1,
            id: 1,
            level: 1,
            email: 1,
            password: 1,
        },
    );
    if (!user) {
        throw new AssertionError({ message: '用户不存在' });
    }

    let messageContent = content;
    if (type === 'text') {
        assert(messageContent.length <= 10240, '消息长度过长');
        const rollRegex = /^-roll( ([0-9]*))?$/;
        if (rollRegex.test(messageContent)) {
            const regexResult = rollRegex.exec(messageContent);
            if (regexResult) {
                let numberStr = regexResult[1] || '100';
                if (numberStr.length > 5) {
                    numberStr = '99999';
                }
                const number = parseInt(numberStr, 10);
                type = 'system';
                messageContent = JSON.stringify({
                    command: 'roll',
                    value: Math.floor(Math.random() * (number + 1)),
                    top: number,
                });
            }
        } else if (/^-rps$/.test(messageContent)) {
            type = 'system';
            messageContent = JSON.stringify({
                command: 'rps',
                value: RPS[Math.floor(Math.random() * RPS.length)],
            });
        }
        messageContent = xss(messageContent);
    } else if (type === 'file') {
        const file: { size: number } = JSON.parse(content);
        assert(file.size < client.maxFileSize, '要发送的文件过大');
        messageContent = content;
    } else if (type === 'inviteV2') {
        const shareTargetGroup = await Group.findOne({ _id: content });
        if (!shareTargetGroup) {
            throw new AssertionError({ message: '目标群组不存在' });
        }
        const user = await User.findOne({ _id: ctx.socket.user });
        if (!user) {
            throw new AssertionError({ message: '用户不存在' });
        }
        messageContent = JSON.stringify({
            inviter: user._id,
            group: shareTargetGroup._id,
        });
    }

    const banedIPLocs = process.env.BANED_IP_LOCS;

    if (banedIPLocs) {
        const banedIPLocsArray = banedIPLocs.split(',');
        if (
            toGroup &&
            toGroup.isDefault &&
            banedIPLocsArray.includes(user.tag)
        ) {
            if (process.env.BANED_ONLY_UNSET_PASSWORD === 'true') {
                if (!user.password) {
                    throw new AssertionError({
                        message: `${user.tag}的${process.env.DEFAULT_USERNAME}不能在群组中发言, 请先在左上角设置密码`,
                    });
                }
            } else {
                throw new AssertionError({
                    message: `${user.tag}的${process.env.DEFAULT_USERNAME}不能在群组中发言`,
                });
            }
        }
    }

    const lastMessageKey = `chat:lastMessage:${user._id}`;
    const lastMessage = await Redis.get(lastMessageKey);
    if (lastMessage && lastMessage === messageContent) {
        throw new AssertionError({ message: '已过滤重复的消息' });
    }
    await Redis.set(lastMessageKey, messageContent, 5);

    const lastDBMessage = await Message.findOne(
        {
            from: ctx.socket.user,
            to: to,
        },
        { content: 1 },
        { sort: { createTime: -1 }, limit: 1 }
    );

    if (lastDBMessage && lastDBMessage.content === messageContent) {
        throw new AssertionError({ message: '已过滤重复的消息' });
    }

    if (toUser) {
        const friend = await Friend.find({ from: toUser._id, to: user });
        if (friend.length === 0) {
            Friend.create({
                from: toUser._id,
                to: user._id,
            } as FriendDocument);
        }
    }

    const message = await Message.create({
        from: ctx.socket.user,
        to,
        type,
        content: messageContent,
    } as MessageDocument);

    const messageData = {
        _id: message._id,
        createTime: message.createTime,
        from: user.toObject(),
        to,
        type,
        content: message.content,
    };

    if (type === 'inviteV2') {
        await handleInviteV2Message(messageData);
    }

    if (toGroup) {
        ctx.socket.emit(toGroup._id.toString(), 'message', messageData);

        const notifications = await Notification.find({
            user: {
                $in: toGroup.members,
            },
        });
        const notificationTokens: string[] = [];
        notifications.forEach((notification) => {
            // Messages sent by yourself don’t push notification to yourself
            if (
                notification.user._id.toString() === ctx.socket.user.toString()
            ) {
                return;
            }
            notificationTokens.push(notification.token);
        });
        if (notificationTokens.length) {
            pushNotification(
                notificationTokens,
                messageData as unknown as MessageDocument,
                toGroup.name,
            );
        }
    } else {
        const targetSockets = await Socket.find({ user: toUser?._id });
        const targetSocketIdList =
            targetSockets?.map((socket) => socket.id) || [];
        if (targetSocketIdList.length) {
            ctx.socket.emit(targetSocketIdList, 'message', messageData);
        }

        const selfSockets = await Socket.find({ user: ctx.socket.user });
        const selfSocketIdList = selfSockets?.map((socket) => socket.id) || [];
        if (selfSocketIdList.length) {
            ctx.socket.emit(selfSocketIdList, 'message', messageData);
        }

        const notificationTokens = await Notification.find({ user: toUser });
        if (notificationTokens.length) {
            pushNotification(
                notificationTokens.map(({ token }) => token),
                messageData as unknown as MessageDocument,
            );
        }

        const notifyKey = process.env.NOTIFY_KEY;
        if (
            notifyKey &&
            toUser &&
            toUser.tag !== 'bot' &&
            toUser.password &&
            user.username !== toUser.username
        ) {
            const jsonStr = JSON.stringify({
                from_user_id: user.id,
                to_user_id: toUser?.id,
                from_username: user.username,
                msg_type: type,
                content: message.content,
            });
            await Redis.lpush(notifyKey, jsonStr);
        }
    }

    createOrUpdateHistory(ctx.socket.user.toString(), to, message._id);

    return messageData;
}

export async function sendBotMessage(ctx: Context<SendMessageData>) {
    const { to, content } = ctx.data;
    const { type } = ctx.data;
    assert(to, 'to不能为空');

    const userId = to.replace(ctx.socket.user.toString(), '');
    assert(isValid(userId), '无效的用户ID');
    const toUser = await User.findOne({ _id: userId });
    assert(toUser, '用户不存在');
    const botName = toUser.username;
    const botAPIName = botName + '_API';
    const botAPI = process.env[botAPIName];
    const user = await User.findOne(
        { _id: ctx.socket.user },
        { username: 1, avatar: 1, tag: 1, id: 1, level: 1, email: 1 },
    );
    if (!user) {
        throw new AssertionError({ message: '用户不存在' });
    }
    let reply = `🔴 ${botName}暂不可用, 请稍后再试`;
    let data = {
        prompt: content,
        group: ctx.socket.user.toString(),
        uid: user.id.toString(),
    };
    const xhr = new XMLHttpRequest();
    xhr.open('POST', botAPI);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.timeout = 10000;
    xhr.send(JSON.stringify(data));
    await new Promise((resolve) => (xhr.onload = resolve)); // 使用 await 等待请求完成
    if (xhr.status === 200) {
        reply = xhr.responseText;
    }
    const bot = toUser;
    // 从bot发送到客户端 user是bot toUser是用户
    const to2 = user._id > bot._id ? bot._id + user._id : user._id + bot._id;
    const message = await Message.create({
        from: bot._id,
        to: to2,
        type: 'text',
        content: reply,
    } as MessageDocument);

    const messageData = {
        _id: message._id,
        createTime: new Date(),
        from: toUser.toObject(),
        to: to2,
        type: 'text',
        content: reply,
    };
    const targetSockets = await Socket.find({ user: bot?._id });
    const targetSocketIdList = targetSockets?.map((socket) => socket.id) || [];
    if (targetSocketIdList.length) {
        ctx.socket.emit(targetSocketIdList, 'message', messageData);
    }

    const selfSockets = await Socket.find({ user: ctx.socket.user });
    const selfSocketIdList = selfSockets?.map((socket) => socket.id) || [];
    if (selfSocketIdList.length) {
        ctx.socket.emit(selfSocketIdList, 'message', messageData);
    }

    return messageData;
}

/**
 * 发送群组BOT消息
 * 如果是发送给群组, to是群组id
 * 如果是发送给个人, to是俩人id按大小序拼接后的值
 * @param ctx Context
 */
export async function sendGroupBotMessage(ctx: Context<SendMessageData>) {
    const { to, content } = ctx.data;
    let { type } = ctx.data;
    assert(to, 'to不能为空');

    let toGroup: GroupDocument | null = null;
    let toUser: UserDocument | null = null;
    if (isValid(to)) {
        toGroup = await Group.findOne({ _id: to });
        assert(toGroup, '群组不存在');
    } else {
        const userId = to.replace(ctx.socket.user.toString(), '');
        assert(isValid(userId), '无效的用户ID');
        toUser = await User.findOne({ _id: userId });
        assert(toUser, '用户不存在');
    }

    let messageContent = content;
    if (type === 'text') {
        assert(messageContent.length <= 10240, '消息长度过长');

        const rollRegex = /^-roll( ([0-9]*))?$/;
        if (rollRegex.test(messageContent)) {
            const regexResult = rollRegex.exec(messageContent);
            if (regexResult) {
                let numberStr = regexResult[1] || '100';
                if (numberStr.length > 5) {
                    numberStr = '99999';
                }
                const number = parseInt(numberStr, 10);
                type = 'system';
                messageContent = JSON.stringify({
                    command: 'roll',
                    value: Math.floor(Math.random() * (number + 1)),
                    top: number,
                });
            }
        } else if (/^-rps$/.test(messageContent)) {
            type = 'system';
            messageContent = JSON.stringify({
                command: 'rps',
                value: RPS[Math.floor(Math.random() * RPS.length)],
            });
        }
        messageContent = xss(messageContent);
    } else if (type === 'file') {
        const file: { size: number } = JSON.parse(content);
        assert(file.size < client.maxFileSize, '要发送的文件过大');
        messageContent = content;
    } else if (type === 'inviteV2') {
        const shareTargetGroup = await Group.findOne({ _id: content });
        if (!shareTargetGroup) {
            throw new AssertionError({ message: '目标群组不存在' });
        }
        const user = await User.findOne({ _id: ctx.socket.user });
        if (!user) {
            throw new AssertionError({ message: '用户不存在' });
        }
        messageContent = JSON.stringify({
            inviter: user._id,
            group: shareTargetGroup._id,
        });
    }

    const user = await User.findOne(
        { _id: ctx.socket.user },
        { username: 1, avatar: 1, tag: 1, id: 1 },
    );
    if (!user) {
        throw new AssertionError({ message: '用户不存在' });
    }

    const botName = process.env.DEFAULT_BOT_NAME;
    const botAPIName = botName + '_API';
    const botAPI = process.env[botAPIName];

    const bot = await User.findOne({ username: botName });

    if (!bot) {
        throw new AssertionError({ message: `${botName}不存在` });
    }

    if (toGroup && toGroup.members.indexOf(bot._id) === -1) {
        toGroup.members.push(bot._id);
    }

    let reply = `🔴${botName}暂不可用, 请稍后再试`;

    let data = {
        prompt: content,
        group: ctx.socket.user.toString(),
        uid: user.id.toString(),
    };
    const xhr = new XMLHttpRequest();
    xhr.open('POST', botAPI);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.timeout = 10000;
    xhr.send(JSON.stringify(data));
    await new Promise((resolve) => (xhr.onload = resolve)); // 使用 await 等待请求完成
    if (xhr.status === 200) {
        reply = xhr.responseText;
    }
    const message = await Message.create({
        from: bot._id,
        to,
        type: 'text',
        content: reply,
    } as MessageDocument);

    const messageData = {
        _id: message._id,
        createTime: message.createTime,
        from: bot.toObject(),
        to,
        type: 'text',
        content: message.content,
    };

    if (toGroup) {
        ctx.socket.emit(toGroup._id.toString(), 'message', messageData);
    }

    return messageData;
}

/**
 * 获取一组联系人的最后历史消息
 * @param ctx Context
 */
export async function getLinkmansLastMessages(
    ctx: Context<{ linkmans: string[] }>,
) {
    const { linkmans } = ctx.data;
    assert(Array.isArray(linkmans), '参数linkmans应该是Array');

    const promises = linkmans.map(async (linkmanId) => {
        const messages = await Message.find(
            { to: linkmanId },
            {
                type: 1,
                content: 1,
                from: 1,
                createTime: 1,
                deleted: 1,
            },
            { sort: { createTime: -1 }, limit: FirstTimeMessagesCount },
        ).populate('from', { username: 1, avatar: 1, tag: 1 });
        await handleInviteV2Messages(messages);
        return messages;
    });
    const results = await Promise.all(promises);
    type Messages = {
        [linkmanId: string]: MessageDocument[];
    };
    const messages = linkmans.reduce((result: Messages, linkmanId, index) => {
        result[linkmanId] = (results[index] || []).reverse();
        return result;
    }, {});

    return messages;
}

export async function getLinkmansLastMessagesV2(
    ctx: Context<{ linkmans: string[] }>,
) {
    const { linkmans } = ctx.data;

    const histories = await History.find({
        user: ctx.socket.user.toString(),
        linkman: {
            $in: linkmans,
        },
    });
    const historyMap = histories
        .filter(Boolean)
        .reduce((result: { [linkman: string]: string }, history) => {
            result[history.linkman] = history.message;
            return result;
        }, {});

    const linkmansMessages = await Promise.all(
        linkmans.map(async (linkmanId) => {
            const messages = await Message.find(
                { to: linkmanId },
                {
                    type: 1,
                    content: 1,
                    from: 1,
                    createTime: 1,
                    deleted: 1,
                },
                {
                    sort: { createTime: -1 },
                    limit: historyMap[linkmanId] ? 100 : FirstTimeMessagesCount,
                },
            ).populate('from', { username: 1, avatar: 1, tag: 1 });
            await handleInviteV2Messages(messages);
            return messages;
        }),
    );

    type ResponseData = {
        [linkmanId: string]: {
            messages: MessageDocument[];
            unread: number;
        };
    };
    const responseData = linkmans.reduce(
        (result: ResponseData, linkmanId, index) => {
            const messages = linkmansMessages[index];
            if (historyMap[linkmanId]) {
                const messageIndex = messages.findIndex(
                    ({ _id }) => _id.toString() === historyMap[linkmanId],
                );
                result[linkmanId] = {
                    messages: messages.slice(0, 15).reverse(),
                    unread: messageIndex === -1 ? 100 : messageIndex,
                };
            } else {
                result[linkmanId] = {
                    messages: messages.reverse(),
                    unread: 0,
                };
            }
            return result;
        },
        {},
    );

    return responseData;
}

/**
 * 获取联系人的历史消息
 * @param ctx Context
 */
export async function getLinkmanHistoryMessages(
    ctx: Context<{ linkmanId: string; existCount: number }>,
) {
    const { linkmanId, existCount } = ctx.data;

    const messages = await Message.find(
        { to: linkmanId },
        {
            type: 1,
            content: 1,
            from: 1,
            createTime: 1,
            deleted: 1,
        },
        {
            sort: { createTime: -1 },
            limit: EachFetchMessagesCount + existCount,
        },
    ).populate('from', { username: 1, avatar: 1, tag: 1 });
    await handleInviteV2Messages(messages);
    const result = messages.slice(existCount).reverse();
    return result;
}

/**
 * 获取默认群组的历史消息
 * @param ctx Context
 */
export async function getDefaultGroupHistoryMessages(
    ctx: Context<{ existCount: number }>,
) {
    const { existCount } = ctx.data;

    const group = await Group.findOne({ isDefault: true });
    if (!group) {
        throw new AssertionError({ message: '默认群组不存在' });
    }
    const messages = await Message.find(
        { to: group._id },
        {
            type: 1,
            content: 1,
            from: 1,
            createTime: 1,
            deleted: 1,
        },
        {
            sort: { createTime: -1 },
            limit: EachFetchMessagesCount + existCount,
        },
    ).populate('from', { username: 1, avatar: 1, tag: 1 });
    await handleInviteV2Messages(messages);
    const result = messages.slice(existCount).reverse();
    return result;
}

/**
 * 删除消息, 需要管理员权限
 */
export async function deleteMessage(ctx: Context<{ messageId: string }>) {
    assert(
        !client.disableDeleteMessage || ctx.socket.isAdmin,
        '已禁止撤回消息',
    );

    const { messageId } = ctx.data;
    assert(messageId, 'messageId不能为空');

    const message = await Message.findOne({ _id: messageId });
    if (!message) {
        // throw new AssertionError({ message: '消息不存在' });
        throw new AssertionError({ message: '消息已被自动清理 请刷新' });
    }
    assert(
        ctx.socket.isAdmin ||
            message.from.toString() === ctx.socket.user.toString(),
        '只能撤回本人的消息',
    );

    if (ctx.socket.isAdmin) {
        await Message.deleteOne({ _id: messageId });
    } else {
        message.deleted = true;
        await message.save();
    }

    /**
     * 广播删除消息通知, 区分群消息和私聊消息
     */
    const messageName = 'deleteMessage';
    const messageData = {
        linkmanId: message.to.toString(),
        messageId,
        isAdmin: ctx.socket.isAdmin,
    };
    if (isValid(message.to)) {
        // 群消息
        ctx.socket.emit(message.to.toString(), messageName, messageData);
    } else {
        // 私聊消息
        const targetUserId = message.to.replace(ctx.socket.user.toString(), '');
        const targetSockets = await Socket.find({ user: targetUserId });
        const targetSocketIdList =
            targetSockets?.map((socket) => socket.id) || [];
        if (targetSocketIdList) {
            ctx.socket.emit(targetSocketIdList, messageName, messageData);
        }

        const selfSockets = await Socket.find({ user: ctx.socket.user });
        const selfSocketIdList = selfSockets?.map((socket) => socket.id) || [];
        if (selfSocketIdList) {
            ctx.socket.emit(
                selfSocketIdList.filter(
                    (socketId) => socketId !== ctx.socket.id,
                ),
                messageName,
                messageData,
            );
        }
    }

    return {
        msg: 'ok',
    };
}
