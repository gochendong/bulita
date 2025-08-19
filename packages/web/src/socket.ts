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
} from './service';
import store from './state/store';
// import useAction from "./hooks/useAction";

const { dispatch } = store;

const options = {
    // reconnectionDelay: 1000,
};
const socket = IO(config.server, options);

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
            return;
        } 
        // window.localStorage.removeItem('token');
        
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
const defaultTitle = process.env.DEFAULT_TITLE;
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
