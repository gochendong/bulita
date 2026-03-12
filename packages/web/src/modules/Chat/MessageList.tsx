import React, { useRef, useState, useEffect } from 'react';
import { useSelector } from 'react-redux';

import { css } from 'linaria';
import { State, Message } from '../../state/reducer';
import useIsLogin from '../../hooks/useIsLogin';
import useAction from '../../hooks/useAction';
import {
    getLinkmanHistoryMessages,
    getDefaultGroupHistoryMessages,
    updateHistory,
    getGroupAllMembers,
    getDefaultGroupAllMembers,
    GroupAllMemberItem,
} from '../../service';
import MessageComponent from './Message/Message';

import Style from './MessageList.less';

const styles = {
    container: css`
        flex: 1;
        position: relative;
        overflow: hidden;
    `,
    unread: css`
        position: absolute;
        bottom: 6px;
        left: 50%;
        transform: translateX(-50%);
        background-color: var(--primary-color-8);
        font-size: 14px;
        color: var(--primary-text-color-9);
        padding: 3px 8px;
        border-radius: 3px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
    `,
};

interface MessageListProps {
    onRetry?: (linkmanId: string, messageId: string) => void;
}

function MessageList(props: MessageListProps) {
    const { onRetry } = props;
    const action = useAction();
    const selfId = useSelector((state: State) => state.user?._id || '');
    const focus = useSelector((state: State) => state.focus);
    const isGroup = useSelector(
        (state: State) => state.linkmans[focus].type === 'group',
    );
    const creator = useSelector(
        (state: State) => state.linkmans[focus].creator,
    );
    const messages = useSelector(
        (state: State) => state.linkmans[focus].messages,
    );
    const linkman = useSelector((state: State) => state.linkmans[focus]);
    const unread = useSelector((state: State) => state.linkmans[focus].unread);
    const isLogin = useIsLogin();
    const tagColorMode = useSelector(
        (state: State) => state.status.tagColorMode,
    );

    const $list = useRef<HTMLDivElement>(null);
    // 群成员信息缓存（用于获取createTime显示UserBadge）
    const [groupMembersMap, setGroupMembersMap] = useState<Map<string, string | null>>(new Map());
    // 群成员在线状态（用于点击头像时显示在线/离线）
    const [groupMembersStatusMap, setGroupMembersStatusMap] = useState<Map<string, { isOnline: boolean; lastLoginTime: string | null }>>(new Map());

    // 如果是群聊，获取所有成员信息并缓存createTime、在线状态
    useEffect(() => {
        if (isGroup && focus) {
            if (isLogin) {
                getGroupAllMembers(focus).then((members) => {
                    const createTimeMap = new Map<string, string | null>();
                    const statusMap = new Map<string, { isOnline: boolean; lastLoginTime: string | null }>();
                    members.forEach((member) => {
                        createTimeMap.set(member.user._id, member.user.createTime);
                        statusMap.set(member.user._id, {
                            isOnline: member.isOnline,
                            lastLoginTime: member.user.lastLoginTime || null,
                        });
                    });
                    setGroupMembersMap(createTimeMap);
                    setGroupMembersStatusMap(statusMap);
                });
            } else {
                // 游客用户获取默认群组的所有成员
                getDefaultGroupAllMembers().then((members) => {
                    const createTimeMap = new Map<string, string | null>();
                    const statusMap = new Map<string, { isOnline: boolean; lastLoginTime: string | null }>();
                    members.forEach((member) => {
                        createTimeMap.set(member.user._id, member.user.createTime);
                        statusMap.set(member.user._id, {
                            isOnline: member.isOnline,
                            lastLoginTime: member.user.lastLoginTime || null,
                        });
                    });
                    setGroupMembersMap(createTimeMap);
                    setGroupMembersStatusMap(statusMap);
                });
            }
        } else {
            setGroupMembersMap(new Map());
            setGroupMembersStatusMap(new Map());
        }
    }, [focus, isGroup, isLogin]);

    function clearUnread() {
        action.setLinkmanProperty(focus, 'unread', 0);
        const messageKeys = Object.keys(messages);
        if (messageKeys.length > 0) {
            updateHistory(
                focus,
                messages[messageKeys[messageKeys.length - 1]]._id,
            );
        }
    }

    let isFetching = false;
    async function handleScroll(e: any) {
        // Don't know why the code-view dialog will also trigger when scrolling
        if ($list.current && e.target !== $list.current) {
            return;
        }
        if (isFetching) {
            return;
        }

        const $div = e.target as HTMLDivElement;

        if (
            unread &&
            $div.scrollHeight - $div.clientHeight - $div.scrollTop > 50
        ) {
            clearUnread();
        }

        if ($div.scrollTop === 0 && $div.scrollHeight > $div.clientHeight) {
            isFetching = true;
            let historyMessages: Message[] = [];
            if (isLogin) {
                historyMessages = await getLinkmanHistoryMessages(
                    focus,
                    Object.keys(messages).length,
                );
            } else {
                historyMessages = await getDefaultGroupHistoryMessages(
                    Object.keys(messages).length,
                );
            }
            if (historyMessages && historyMessages.length > 0) {
                action.addLinkmanHistoryMessages(focus, historyMessages);
            }
            isFetching = false;
        }
    }

    function renderMessage(message: Message) {
        const isSelf = message.from._id === selfId;
        let shouldScroll = true;
        if ($list.current) {
            // @ts-ignore
            const { scrollHeight, clientHeight, scrollTop } = $list.current;
            shouldScroll =
                isSelf ||
                scrollHeight === clientHeight ||
                scrollTop === 0 ||
                scrollTop > scrollHeight - clientHeight * 2;
        }

        let { tag } = message.from;
        if (message.from.tag === 'bot') {
            tag = 'bot';
        } else if (!isGroup) {
            tag = '';
        } else if (message.from._id === creator) {
            tag = '群主';
        }
        // if (message.from.username === "AI") {
        //     tag = 'bot'
        // }
        // if (!tag && isGroup && message.from._id === creator) {
        //     tag = '群主';
        // }

        // 获取发送者的createTime（用于显示UserBadge）
        // 机器人只显示「机器人」标签，不显示 UserBadge（传奇等）
        let senderCreateTime: string | null = null;
        let senderIsOnline: boolean | undefined;
        let senderLastLoginTime: string | null = null;
        if (!isSelf && message.from._id !== 'system' && message.from.tag !== 'bot') {
            if (linkman.type === 'friend') {
                senderCreateTime = linkman.createTime || null;
                senderIsOnline = linkman.isOnline;
                senderLastLoginTime = linkman.lastLoginTime ?? null;
            } else if (linkman.type === 'group') {
                senderCreateTime = groupMembersMap.get(message.from._id) || null;
                if (!senderCreateTime && (message.from as any).createTime) {
                    senderCreateTime = (message.from as any).createTime;
                }
                const status = groupMembersStatusMap.get(message.from._id);
                if (status) {
                    senderIsOnline = status.isOnline;
                    senderLastLoginTime = status.lastLoginTime;
                }
            }
        }

        return (
            <MessageComponent
                key={message._id}
                id={message._id}
                linkmanId={focus}
                isSelf={isSelf}
                userId={message.from._id}
                avatar={message.from.avatar}
                username={message.from.username}
                originUsername={message.from.originUsername}
                time={message.createTime}
                type={message.type}
                content={message.content}
                tag={tag}
                loading={message.loading}
                percent={message.percent}
                sendFailed={message.sendFailed}
                onRetry={onRetry}
                shouldScroll={shouldScroll}
                tagColorMode={tagColorMode}
                senderCreateTime={senderCreateTime}
                senderIsOnline={senderIsOnline}
                senderLastLoginTime={senderLastLoginTime}
            />
        );
    }

    return (
        <div className={styles.container}>
            <div
                className={`${Style.messageList} show-scrollbar`}
                onScroll={handleScroll}
                ref={$list}
            >
                {Object.values(messages).map((message) =>
                    renderMessage(message),
                )}
            </div>
        </div>
    );
}

export default MessageList;
