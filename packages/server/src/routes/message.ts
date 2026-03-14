/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import axios from 'axios';
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
    GroupAISwitchKey,
    Redis,
    DisableRegisterUserSendMessageKey,
} from '@bulita/database/redis/initRedis';
import { getConfig, getConfigWithDefault } from '../utils/runtimeConfig';
import Friend, {
    FriendDocument,
} from '@bulita/database/mongoose/models/friend';
import client from '../../../config/client';
import config from '@bulita/config/server';

const { isValid } = Types.ObjectId;
const adminEmails = config.adminEmails.map((email) => email.trim()).filter(Boolean);

/** 初次获取历史消息数 */
const FirstTimeMessagesCount = 60;
/** 每次调用接口获取的历史消息数 */
const EachFetchMessagesCount = 30;

const OneYear = 365 * 24 * 3600 * 1000;

/** 石头剪刀布, 用于随机生成结果 */
const RPS = ['石头', '剪刀', '布'];

const { XMLHttpRequest } = require('xmlhttprequest');

type OpenAIChatMessage = {
    role: 'system' | 'user' | 'assistant';
    content: string;
};

type AIStreamEventMessage = {
    _id: string;
    createTime: Date;
    from: Record<string, any>;
    to: string;
    type: 'text';
    content: string;
    loading: boolean;
};

type AIStreamEventPayload = {
    linkmanId: string;
    messageId: string;
    message: AIStreamEventMessage;
};

function normalizeContextCount(value: unknown, fallback = 10) {
    const parsed = parseInt(`${value ?? ''}`, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return fallback;
    }
    return Math.min(parsed, 50);
}

async function resolveAIConfig(
    user: Pick<UserDocument, 'aiApiKey' | 'aiBaseUrl' | 'aiModel' | 'aiContextCount'>,
) {
    const defaultApiKey = (await getConfigWithDefault('OPENAI_API_KEY')).trim()
        || config.openai.apiKey
        || '';
    const defaultBaseUrl = (await getConfigWithDefault('OPENAI_BASE_URL')).trim()
        || config.openai.baseUrl
        || '';
    const defaultModel = (await getConfigWithDefault('OPENAI_MODEL')).trim()
        || config.openai.model
        || '';
    const defaultContextCount = normalizeContextCount(
        await getConfigWithDefault('OPENAI_CONTEXT_COUNT'),
        normalizeContextCount(config.openai.contextCount, 10),
    );

    const apiKey = `${user.aiApiKey ?? ''}`.trim() || defaultApiKey.trim();
    const baseUrl = `${user.aiBaseUrl ?? ''}`.trim() || defaultBaseUrl.trim();
    const model = `${user.aiModel ?? ''}`.trim() || defaultModel.trim();
    const contextCount =
        user.aiContextCount === undefined || user.aiContextCount === null || user.aiContextCount === ''
            ? defaultContextCount
            : normalizeContextCount(user.aiContextCount, defaultContextCount);

    assert(apiKey, '未配置 AI API Key');
    assert(baseUrl, '未配置 AI Base URL');
    assert(model, '未配置 AI Model');

    return {
        apiKey,
        baseUrl,
        model,
        contextCount,
    };
}

function resolveChatCompletionsUrl(baseUrl: string) {
    const normalized = baseUrl.trim().replace(/\/+$/, '');
    if (/\/chat\/completions$/i.test(normalized)) {
        return normalized;
    }
    return `${normalized}/chat/completions`;
}

function normalizeAssistantReply(content: unknown) {
    if (typeof content === 'string') {
        return content.trim();
    }
    if (Array.isArray(content)) {
        return content
            .map((item) => {
                if (typeof item === 'string') {
                    return item;
                }
                if (item && typeof item === 'object' && 'text' in item) {
                    return `${(item as { text?: string }).text || ''}`;
                }
                return '';
            })
            .join('\n')
            .trim();
    }
    return '';
}

async function getPrimaryBotName() {
    return (await getConfigWithDefault('BOTS'))
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean)[0] || '';
}

async function buildConversationMessages(
    userId: string,
    botId: string,
    contextCount: number,
    isGroup: boolean,
) {
    const messages = await Message.find(
        {
            aiContextOwner: userId,
            aiContextBot: botId,
            type: 'text',
            deleted: { $ne: true },
        },
        {
            from: 1,
            content: 1,
            createTime: 1,
        },
        {
            sort: { createTime: -1 },
            limit: Math.max(contextCount + 1, 1),
        },
    ).populate('from', { username: 1 });

    return messages
        .reverse()
        .map((message) => {
            const from = message.from as unknown as { _id?: { toString: () => string }; username?: string };
            const fromId = from?._id?.toString?.() || `${message.from}`;
            const isAssistant = fromId === botId;
            const role: OpenAIChatMessage['role'] = isAssistant ? 'assistant' : 'user';
            const prefix = isGroup && !isAssistant ? `${from?.username || '用户'}: ` : '';
            return {
                role,
                content: `${prefix}${message.content}`.trim(),
            };
        })
        .filter((message) => message.content);
}

async function streamAIReply(
    aiUser: Pick<UserDocument, 'aiApiKey' | 'aiBaseUrl' | 'aiModel' | 'aiContextCount'>,
    botName: string,
    requesterId: string,
    botId: string,
    isGroup: boolean,
    onProgress?: (reply: string) => Promise<void> | void,
) {
    const { apiKey, baseUrl, model, contextCount } = await resolveAIConfig(
        aiUser,
    );
    const historyMessages = await buildConversationMessages(
        requesterId,
        botId,
        contextCount,
        isGroup,
    );
    const messages: OpenAIChatMessage[] = [
        {
            role: 'system',
            content: isGroup
                ? `你是群聊机器人 ${botName}。请结合最近聊天上下文自然回复，保持简洁，优先使用中文。`
                : `你是私聊机器人 ${botName}。请结合上下文自然回复，保持简洁，优先使用中文。`,
        },
        ...historyMessages,
    ];

    const response = await axios.post(
        resolveChatCompletionsUrl(baseUrl),
        {
            model,
            messages,
            stream: true,
        },
        {
            timeout: 0,
            responseType: 'stream',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        },
    );

    let buffer = '';
    let reply = '';
    let done = false;

    for await (const chunk of response.data as AsyncIterable<Buffer | string>) {
        buffer += chunk.toString();

        let separatorIndex = buffer.search(/\r?\n\r?\n/);
        while (separatorIndex !== -1) {
            const rawEvent = buffer.slice(0, separatorIndex);
            const separatorLength = buffer[separatorIndex] === '\r' ? 4 : 2;
            buffer = buffer.slice(separatorIndex + separatorLength);

            const lines = rawEvent.split(/\r?\n/);
            for (const line of lines) {
                if (!line.startsWith('data:')) {
                    continue;
                }
                const data = line.slice(5).trim();
                if (!data) {
                    continue;
                }
                if (data === '[DONE]') {
                    done = true;
                    break;
                }

                try {
                    const parsed = JSON.parse(data);
                    const delta = normalizeAssistantReply(
                        parsed?.choices?.[0]?.delta?.content ??
                            parsed?.choices?.[0]?.message?.content,
                    );
                    if (delta) {
                        reply += delta;
                        if (onProgress) {
                            await onProgress(reply);
                        }
                    }
                } catch (error) {
                    logger.warn(
                        '[streamAIReply] Failed to parse chunk:',
                        (error as Error).message,
                    );
                }
            }

            if (done) {
                break;
            }
            separatorIndex = buffer.search(/\r?\n\r?\n/);
        }

        if (done) {
            break;
        }
    }

    return reply.trim() || `🔴 ${botName}暂不可用, 请稍后再试`;
}

function buildAIStreamMessage(
    messageId: string,
    from: Record<string, any>,
    to: string,
    content: string,
    createTime = new Date(),
    loading = true,
): AIStreamEventMessage {
    return {
        _id: messageId,
        createTime,
        from,
        to,
        type: 'text',
        content,
        loading,
    };
}

async function tagAIContextMessage(
    requesterId: string,
    conversationId: string,
    botId: string,
    content: string,
) {
    if (!content) {
        return;
    }
    await Message.findOneAndUpdate(
        {
            from: requesterId,
            to: conversationId,
            type: 'text',
            content,
            createTime: { $gte: new Date(Date.now() - 5 * 60 * 1000) },
        },
        {
            aiContextOwner: requesterId,
            aiContextBot: botId,
        },
        {
            sort: { createTime: -1 },
        },
    );
}

function getCurrentSocket(ctx: Context<any>) {
    return (ctx.socket as any).__socket;
}

function emitToCurrentSocket(
    ctx: Context<any>,
    event: string,
    payload: AIStreamEventPayload,
) {
    const socket = getCurrentSocket(ctx);
    if (socket) {
        socket.emit(event, payload);
    }
}

async function emitToUserSockets(
    ctx: Context<any>,
    userId: string,
    event: string,
    payload: AIStreamEventPayload,
    excludeSocketId?: string,
) {
    const sockets = await Socket.find({ user: userId });
    const socketIds =
        sockets
            ?.map((socket) => socket.id)
            .filter((socketId) => socketId !== excludeSocketId) || [];
    if (socketIds.length) {
        ctx.socket.emit(socketIds, event, payload);
    }
}

async function emitPrivateAIEvent(
    ctx: Context<any>,
    userId: string,
    event: string,
    payload: AIStreamEventPayload,
    includeCurrent = true,
) {
    if (includeCurrent) {
        emitToCurrentSocket(ctx, event, payload);
    }
    await emitToUserSockets(ctx, userId, event, payload, ctx.socket.id);
}

function emitGroupAIEvent(
    ctx: Context<any>,
    groupId: string,
    event: string,
    payload: AIStreamEventPayload,
    includeCurrent = true,
) {
    if (includeCurrent) {
        emitToCurrentSocket(ctx, event, payload);
    }
    ctx.socket.emit(groupId, event, payload);
}

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

    // 根据 Redis 中的禁言开关（全员禁言 / 未注册用户禁言）限制发言
    if (
        toGroup ||
        (toUser &&
            toUser.tag !== 'bot' &&
            !(toUser.email && adminEmails.includes(toUser.email)))
    ) {
        const disableSendMessage = await Redis.get(DisableSendMessageKey);
        assert(
            disableSendMessage !== 'true' || ctx.socket.isAdmin,
            '全员禁言中',
        );
        const disableNoRegisterUserSendMessage = await Redis.get(
            DisableRegisterUserSendMessageKey,
        );
        if (disableNoRegisterUserSendMessage === 'true') {
            const user = await User.findById(ctx.socket.user);
            const isRegisterUser = user && user.email;
            assert(
                ctx.socket.isAdmin || isRegisterUser,
                '游客禁言中',
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

        if (
            toUser &&
            toUser.pushToken &&
            toUser.tag !== 'bot' &&
            user.username !== toUser.username
        ) {
            const domain = await getConfigWithDefault('PRIVATE_MSG_CALLBACK_DOMAIN') || 'https://chat.bulita.net'
            const jsonStr = JSON.stringify({
                title: "收到来自 " + user.username + " 的新消息",
                content: `<a href='${domain}'>去回复（请先在浏览器中打开）</a>`,
            });
            const lastPushKey = `chat:pushMessage:${user._id}`;
            const lastPush = await Redis.get(lastPushKey);
            if (!lastPush) {
                await Redis.set(lastPushKey, 'true', 60);
                const xhr = new XMLHttpRequest();
                xhr.open('POST', `https://push.showdoc.com.cn/server/api/push/${toUser.pushToken}`);
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.timeout = 10000;
                xhr.send(jsonStr);
        }
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
    const user = await User.findOne(
        { _id: ctx.socket.user },
        {
            username: 1,
            avatar: 1,
            tag: 1,
            id: 1,
            level: 1,
            email: 1,
            aiApiKey: 1,
            aiBaseUrl: 1,
            aiModel: 1,
            aiContextCount: 1,
        },
    );
    if (!user) {
        throw new AssertionError({ message: '用户不存在' });
    }
    const bot = toUser;
    // 从bot发送到客户端 user是bot toUser是用户
    const to2 = user._id > bot._id ? bot._id + user._id : user._id + bot._id;

    if (type === 'text') {
        await tagAIContextMessage(
            ctx.socket.user.toString(),
            to2,
            bot._id.toString(),
            xss(content),
        );
    }

    const message = await Message.create({
        from: bot._id,
        to: to2,
        type: 'text',
        content: '',
    } as MessageDocument);

    const thinkingContent =
        type === 'text'
            ? ''
            : `🔴 ${botName}当前仅支持文本对话`;
    const initialMessage = buildAIStreamMessage(
        message._id.toString(),
        toUser.toObject(),
        to2,
        thinkingContent,
        message.createTime,
        type === 'text',
    );
    const startPayload: AIStreamEventPayload = {
        linkmanId: to2,
        messageId: message._id.toString(),
        message: initialMessage,
    };

    await emitToUserSockets(
        ctx,
        ctx.socket.user.toString(),
        'aiMessageStart',
        startPayload,
        ctx.socket.id,
    );

    if (type !== 'text') {
        message.content = thinkingContent;
        await message.save();
        return initialMessage;
    }

    setTimeout(() => {
        void (async () => {
            let reply = `🔴 ${botName}暂不可用, 请稍后再试`;
            try {
                reply = await streamAIReply(
                    user,
                    botName,
                    ctx.socket.user.toString(),
                    toUser._id.toString(),
                    false,
                    async (contentSoFar) => {
                        const chunkPayload: AIStreamEventPayload = {
                            linkmanId: to2,
                            messageId: message._id.toString(),
                            message: buildAIStreamMessage(
                                message._id.toString(),
                                toUser.toObject(),
                                to2,
                                contentSoFar,
                                message.createTime,
                                true,
                            ),
                        };
                        await emitPrivateAIEvent(
                            ctx,
                            ctx.socket.user.toString(),
                            'aiMessageChunk',
                            chunkPayload,
                        );
                    },
                );
            } catch (error) {
                logger.error('[sendBotMessage]', (error as Error).message);
            }

            message.content = reply;
            message.aiContextOwner = ctx.socket.user.toString();
            message.aiContextBot = bot._id.toString();
            await message.save();

            const donePayload: AIStreamEventPayload = {
                linkmanId: to2,
                messageId: message._id.toString(),
                message: buildAIStreamMessage(
                    message._id.toString(),
                    toUser.toObject(),
                    to2,
                    reply,
                    message.createTime,
                    false,
                ),
            };
            await emitPrivateAIEvent(
                ctx,
                ctx.socket.user.toString(),
                'aiMessageDone',
                donePayload,
            );
        })();
    }, 0);

    return initialMessage;
}

/**
 * 发送群组 BOT 消息
 * 当群聊 AI 开关开启时，用户发送群消息后可调用此接口触发默认机器人回复
 * @param ctx Context
 */
export async function sendGroupBotMessage(ctx: Context<SendMessageData>) {
    const groupAISwitch = (await Redis.get(GroupAISwitchKey)) ?? 'false';
    if (groupAISwitch !== 'true') {
        throw new AssertionError({ message: '群聊 AI 已关闭' });
    }

    const { to, content } = ctx.data;
    let { type } = ctx.data;
    assert(to, 'to不能为空');

    let toGroup: GroupDocument | null = null;
    if (isValid(to)) {
        toGroup = await Group.findOne({ _id: to });
        assert(toGroup, '群组不存在');
    } else {
        throw new AssertionError({ message: '群聊 AI 仅支持群组' });
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

    const botName = await getPrimaryBotName();
    assert(botName, '未配置机器人，请先设置 BOTS');
    const bot = await User.findOne({ username: botName });
    if (!bot) {
        throw new AssertionError({ message: `${botName}不存在` });
    }

    if (toGroup.members.indexOf(bot._id) === -1) {
        toGroup.members.push(bot._id);
        await toGroup.save();
    }

    if (type === 'text') {
        await tagAIContextMessage(
            ctx.socket.user.toString(),
            to,
            bot._id.toString(),
            messageContent,
        );
    }

    const message = await Message.create({
        from: bot._id,
        to,
        type: 'text',
        content: '',
    } as MessageDocument);

    const thinkingContent =
        type === 'text'
            ? ''
            : `🔴 ${botName}当前仅支持文本对话`;
    const initialMessage = buildAIStreamMessage(
        message._id.toString(),
        bot.toObject(),
        to,
        thinkingContent,
        message.createTime,
        type === 'text',
    );
    const startPayload: AIStreamEventPayload = {
        linkmanId: to,
        messageId: message._id.toString(),
        message: initialMessage,
    };

    emitGroupAIEvent(ctx, toGroup._id.toString(), 'aiMessageStart', startPayload, false);

    if (type !== 'text') {
        message.content = thinkingContent;
        await message.save();
        return initialMessage;
    }

    const aiUser = await User.findOne(
        { _id: ctx.socket.user },
        {
            aiApiKey: 1,
            aiBaseUrl: 1,
            aiModel: 1,
            aiContextCount: 1,
        },
    );
    if (!aiUser) {
        throw new AssertionError({ message: '用户不存在' });
    }

    setTimeout(() => {
        void (async () => {
            let reply = `🔴${botName}暂不可用, 请稍后再试`;
            try {
                reply = await streamAIReply(
                    aiUser,
                    botName,
                    ctx.socket.user.toString(),
                    bot._id.toString(),
                    true,
                    async (contentSoFar) => {
                        const chunkPayload: AIStreamEventPayload = {
                            linkmanId: to,
                            messageId: message._id.toString(),
                            message: buildAIStreamMessage(
                                message._id.toString(),
                                bot.toObject(),
                                to,
                                contentSoFar,
                                message.createTime,
                                true,
                            ),
                        };
                        emitGroupAIEvent(
                            ctx,
                            toGroup!._id.toString(),
                            'aiMessageChunk',
                            chunkPayload,
                        );
                    },
                );
            } catch (error) {
                logger.error('[sendGroupBotMessage]', (error as Error).message);
            }

            message.content = reply;
            message.aiContextOwner = ctx.socket.user.toString();
            message.aiContextBot = bot._id.toString();
            await message.save();

            const donePayload: AIStreamEventPayload = {
                linkmanId: to,
                messageId: message._id.toString(),
                message: buildAIStreamMessage(
                    message._id.toString(),
                    bot.toObject(),
                    to,
                    reply,
                    message.createTime,
                    false,
                ),
            };
            emitGroupAIEvent(
                ctx,
                toGroup!._id.toString(),
                'aiMessageDone',
                donePayload,
            );
        })();
    }, 0);

    return initialMessage;
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
