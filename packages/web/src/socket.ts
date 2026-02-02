import IO from 'socket.io-client';
import platform from 'platform';

import convertMessage from '@bulita/utils/convertMessage';
import getFriendId from '@bulita/utils/getFriendId';
import config from '@bulita/config/client';
import notification from './utils/notification';
import voice from './utils/voice';
import { initOSS } from './utils/uploadFile';
import playSound from './utils/playSound';
import { Message, Linkman } from './state/reducer';
import {
    ActionTypes,
    SetLinkmanPropertyPayload,
    AddLinkmanHistoryMessagesPayload,
    AddLinkmanMessagePayload,
    DeleteMessagePayload,
} from './state/action';
import {
    guest,
    loginByToken,
    getLinkmanHistoryMessages,
    getLinkmansLastMessagesV2,
    getPublicSystemConfig,
} from './service';
import store from './state/store';
// import useAction from "./hooks/useAction";

const { dispatch } = store;

const options = {
    transports: ['polling', 'websocket'], // 先尝试 polling，成功后再升级到 websocket
    upgrade: true, // 允许从 polling 升级到 websocket
    rememberUpgrade: false, // 不记住升级状态，每次都尝试升级
    reconnection: true,
    reconnectionDelay: 1000, // 初始重连延迟1秒
    reconnectionDelayMax: 5000, // 最大重连延迟5秒
    reconnectionAttempts: 10, // 最多重连10次
    timeout: 10000, // 连接超时时间10秒
    forceNew: false, // 不强制创建新连接，复用现有连接
    autoConnect: true,
    // 减少 polling 请求频率
    polling: {
        extraHeaders: {},
    },
    // 允许跨域
    withCredentials: true,
};
const socket = IO(config.server, options);

// 监听连接错误，避免无限重连
let reconnectCount = 0;
let lastErrorTime = 0;
socket.on('connect_error', (error: any) => {
    const now = Date.now();
    // 避免频繁打印错误日志（每5秒最多打印一次）
    if (now - lastErrorTime > 5000) {
        // 只记录非 WebSocket 升级相关的错误
        const errorMessage = error?.message || String(error);
        if (!errorMessage.includes('websocket') && !errorMessage.includes('upgrade')) {
            console.warn('Socket连接错误:', errorMessage);
        }
        lastErrorTime = now;
    }
    reconnectCount++;
    // 如果连接失败次数过多，停止自动重连
    if (reconnectCount > 20) {
        console.error('Socket连接失败次数过多，停止自动重连');
        socket.disconnect();
    }
});

socket.on('connect', () => {
    // 连接成功时重置重连计数
    reconnectCount = 0;
    lastErrorTime = 0;
    const transport = socket.io?.engine?.transport?.name || 'unknown';
    // 只在开发环境打印连接信息
    if (process.env.NODE_ENV === 'development') {
        console.log(`Socket连接成功，传输方式: ${transport}`);
    }
});

socket.on('reconnect_attempt', (attemptNumber) => {
    // 只在开发环境或重连次数较多时打印
    if (process.env.NODE_ENV === 'development' || attemptNumber > 5) {
        console.log(`Socket重连尝试 ${attemptNumber}`);
    }
    if (attemptNumber > 10) {
        console.warn('Socket重连次数过多，可能存在问题');
    }
});

socket.on('reconnect_failed', () => {
    console.error('Socket重连失败，已达到最大重连次数');
    reconnectCount = 0; // 重置计数，允许用户手动刷新页面重连
});

// 监听传输方式变化
socket.io?.engine?.on('upgrade', () => {
    if (process.env.NODE_ENV === 'development') {
        console.log('Socket传输方式已升级到 WebSocket');
    }
});

async function loginFailback() {
    const defaultGroup = await guest(
        platform.os?.family,
        platform.name,
        platform.description,
    );
    if (defaultGroup) {
        const { messages } = defaultGroup;
        dispatch({
            type: ActionTypes.SetGuest,
            payload: defaultGroup,
        });

        messages.forEach(convertMessage);
        dispatch({
            type: ActionTypes.AddLinkmanHistoryMessages,
            payload: {
                linkmanId: defaultGroup._id,
                messages,
            },
        });
    }
}

socket.on('connect', async () => {
    dispatch({ type: ActionTypes.Connect, payload: '' });

    await initOSS();
    dispatch({ type: ActionTypes.Ready, payload: '' });

    // B页面 实现跨域自动登录
    function receiveMessage(event) {
        if (event.origin !== 'https://bulita.net') return;

        if (event.data) {
            if (!window.localStorage.getItem('token')) {
                window.localStorage.setItem('token', event.data);
            }
        }
    }

    window.addEventListener('message', receiveMessage, false);

    const token = window.localStorage.getItem('token');

    if (token) {
        const user = await loginByToken(
            token,
            platform.os?.family,
            platform.name,
            platform.description,
        );
        if (user) {
            if (user.bot) {
                window.localStorage.setItem('botAvatar', user.bot.avatar);
            }
            dispatch({
                type: ActionTypes.SetUser,
                payload: user,
            });
            const linkmanIds = [
                ...user.groups.map((group: any) => group._id),
                ...user.friends.map((friend: any) =>
                    getFriendId(friend.from, friend.to._id),
                ),
            ];
            const linkmanMessages = await getLinkmansLastMessagesV2(linkmanIds);
            Object.values(linkmanMessages).forEach(
                // @ts-ignore
                ({ messages }: { messages: Message[] }) => {
                    messages.forEach(convertMessage);
                },
            );
            dispatch({
                type: ActionTypes.SetLinkmansLastMessages,
                payload: linkmanMessages,
            });
            const publicConfig = await getPublicSystemConfig();
            if (publicConfig?.groupAISwitch !== undefined) {
                dispatch({
                    type: ActionTypes.SetStatus,
                    payload: { key: 'groupAISwitch', value: publicConfig.groupAISwitch },
                });
            }
            if (publicConfig?.defaultBotName !== undefined) {
                dispatch({
                    type: ActionTypes.SetStatus,
                    payload: { key: 'defaultBotName', value: publicConfig.defaultBotName || '' },
                });
            }
            if (publicConfig?.maxGroupNum !== undefined) {
                dispatch({
                    type: ActionTypes.SetStatus,
                    payload: { key: 'maxGroupNum', value: publicConfig.maxGroupNum },
                });
            }
            if (publicConfig?.defaultTitle !== undefined && publicConfig.defaultTitle !== '') {
                defaultTitle = publicConfig.defaultTitle;
                document.title = defaultTitle;
            }
            return;
        }
    }
    loginFailback();
});

socket.on('disconnect', () => {
    // @ts-ignore
    dispatch({ type: ActionTypes.Disconnect, payload: null });
});

let intervalIDs = [];
let windowStatus = 'focus';
let notifications = 0;
/** 网站标题，优先从服务端 getPublicSystemConfig 获取，否则使用构建时 env */
let defaultTitle = typeof process !== 'undefined' && process.env?.DEFAULT_TITLE ? process.env.DEFAULT_TITLE : '';
window.onfocus = () => {
    windowStatus = 'focus';
    for (let i = 0; i < intervalIDs.length; i++) {
        clearInterval(intervalIDs[i]);
    }
    intervalIDs = []; // 清空intervalIDs数组
    document.title = defaultTitle;
    notifications = 0;
};
window.onblur = () => {
    windowStatus = 'blur';
};

let prevFrom: string | null = '';
let prevName = '';
socket.on('message', async (message: any) => {
    convertMessage(message);

    const state = store.getState();
    const isSelfMessage = message.from._id === state.user?._id;
    if (isSelfMessage && message.from.tag !== state.user?.tag) {
        dispatch({
            type: ActionTypes.UpdateUserInfo,
            payload: {
                tag: message.from.tag,
            },
        });
    }

    // fix: 重复发送通知
    if (isSelfMessage) {
        return;
    }

    const linkman = state.linkmans[message.to];
    let title = '';
    if (linkman) {
        dispatch({
            type: ActionTypes.AddLinkmanMessage,
            payload: {
                linkmanId: message.to,
                message,
            } as AddLinkmanMessagePayload,
        });
        if (linkman.type === 'group') {
            title = `${message.from.username} 在 ${linkman.name} 对大家说:`;
        } else {
            title = `${message.from.username} 对你说:`;
        }
    } else {
        // 联系人不存在并且是自己发的消息, 不创建新联系人
        if (isSelfMessage) {
            return;
        }
        const newLinkman = {
            _id: getFriendId(state.user?._id as string, message.from._id),
            type: 'temporary',
            createTime: Date.now(),
            avatar: message.from.avatar,
            name: message.from.username,
            messages: [],
            unread: 1,
        };
        dispatch({
            type: ActionTypes.AddLinkman,
            payload: {
                linkman: newLinkman as unknown as Linkman,
                focus: false,
            },
        });
        title = `${message.from.username} 对你说:`;

        const messages = await getLinkmanHistoryMessages(newLinkman._id, 0);
        if (messages) {
            dispatch({
                type: ActionTypes.AddLinkmanHistoryMessages,
                payload: {
                    linkmanId: newLinkman._id,
                    messages,
                } as AddLinkmanHistoryMessagesPayload,
            });
        }
    }

    if (windowStatus === 'blur' && state.status.notificationSwitch) {
        const body =
            message.type === 'text'
                ? message.content.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                : `[${message.type}]`;
        let count = 0; // 切换title
        notifications++;
        const titleText = notifications > 1 ? 'notifications' : 'notification';
        for (let i = 0; i < intervalIDs.length; i++) {
            clearInterval(intervalIDs[i]);
        }
        intervalIDs = []; // 清空intervalIDs数组

        function blinkNewMsg() {
            document.title =
                count % 2 == 0 ? `${notifications} ${titleText}` : defaultTitle;
            count++;
        }
        const intervalID = setInterval(() => {
            blinkNewMsg();
        }, 1000);
        intervalIDs.push(intervalID); // 将intervalID添加到数组中
        notification(
            title,
            message.from.avatar,
            body,
            Math.random().toString(),
        );
    }

    if (state.status.soundSwitch && linkman.type !== 'group') {
        const soundType = state.status.sound;
        playSound(soundType);
    }

    // 停用
    return;

    if (state.status.voiceSwitch) {
        if (message.type === 'text') {
            const text = message.content
                .replace(
                    /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)/g,
                    '',
                )
                .replace(/#/g, '');

            if (text.length > 100) {
                return;
            }

            const from =
                linkman && linkman.type === 'group'
                    ? `${message.from.username}${
                        linkman.name === prevName ? '' : `在${linkman.name}`
                    }说`
                    : `${message.from.username}对你说`;
            if (text) {
                voice.push(
                    from !== prevFrom ? from + text : text,
                    message.from.username,
                );
            }
            prevFrom = from;
            prevName = message.from.username;
        } else if (message.type === 'system') {
            voice.push(message.from.originUsername + message.content, '');
            prevFrom = null;
        }
    }
});

socket.on(
    'changeGroupName',
    ({ groupId, name }: { groupId: string; name: string }) => {
        dispatch({
            type: ActionTypes.SetLinkmanProperty,
            payload: {
                linkmanId: groupId,
                key: 'name',
                value: name,
            } as SetLinkmanPropertyPayload,
        });
    },
);

socket.on(
    'changeGroupAnnouncement',
    ({
        groupId,
        announcement,
    }: {
        groupId: string;
        announcement: string;
    }) => {
        dispatch({
            type: ActionTypes.SetLinkmanProperty,
            payload: {
                linkmanId: groupId,
                key: 'announcement',
                value: announcement,
            } as SetLinkmanPropertyPayload,
        });
    },
);

socket.on('deleteGroup', ({ groupId }: { groupId: string }) => {
    dispatch({
        type: ActionTypes.RemoveLinkman,
        payload: groupId,
    });
});

socket.on('changeTag', (tag: string) => {
    dispatch({
        type: ActionTypes.UpdateUserInfo,
        payload: {
            tag,
        },
    });
});

socket.on(
    'deleteMessage',
    ({
        linkmanId,
        messageId,
        isAdmin,
    }: {
        linkmanId: string;
        messageId: string;
        isAdmin: boolean;
    }) => {
        dispatch({
            type: ActionTypes.DeleteMessage,
            payload: {
                linkmanId,
                messageId,
                shouldDelete: isAdmin,
            } as DeleteMessagePayload,
        });
    },
);

export default socket;
