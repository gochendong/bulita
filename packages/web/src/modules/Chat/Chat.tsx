import React, { useContext, useState, useEffect } from 'react';
import { useSelector } from 'react-redux';

import Style from './Chat.less';
import HeaderBar from './HeaderBar';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import GroupManagePanel from './GroupManagePanel';
import GoogleLogin from '../LoginAndRegister/GoogleLogin';
import LinkifyText from '../../components/LinkifyText';
import { State, GroupMember } from '../../state/reducer';
import { ShowUserOrGroupInfoContext } from '../../context';
import useIsLogin from '../../hooks/useIsLogin';
import {
    getGroupOnlineMembers,
    getUserOnlineStatus,
    updateHistory,
} from '../../service';
import useAction from '../../hooks/useAction';
import useAero from '../../hooks/useAero';
import store from '../../state/store';

let lastMessageIdCache = '';

function Chat() {
    const isLogin = useIsLogin();
    const action = useAction();
    const hasUserInfo = useSelector((state: State) => !!state.user);
    const focus = useSelector((state: State) => state.focus);
    const linkman = useSelector((state: State) => state.linkmans[focus]);
    const [groupManagePanel, toggleGroupManagePanel] = useState(false);
    const context = useContext(ShowUserOrGroupInfoContext);
    const aero = useAero();
    const self = useSelector((state: State) => state.user?._id) || '';

    function handleBodyClick(e: MouseEvent) {
        const { currentTarget } = e;
        let target = e.target as HTMLDivElement;
        do {
            if (target.getAttribute('data-float-panel') === 'true') {
                return;
            }
            // @ts-ignore
            target = target.parentElement;
        } while (target && target !== currentTarget);
        toggleGroupManagePanel(false);
    }
    useEffect(() => {
        document.body.addEventListener('click', handleBodyClick, false);
        return () => {
            document.body.removeEventListener('click', handleBodyClick, false);
        };
    }, []);

    useEffect(() => {
        if (!linkman) {
            return;
        }
        
        async function fetchGroupOnlineMembers() {
            let onlineMembers: GroupMember[] | { cache: true } = [];
            if (isLogin) {
                onlineMembers = await getGroupOnlineMembers(focus);
            }
            if (Array.isArray(onlineMembers)) {
                action.setLinkmanProperty(focus, 'onlineMembers', onlineMembers);
            }
        }
        
        async function fetchUserOnlineStatus() {
            const status = await getUserOnlineStatus(focus.replace(self, ''));
            if (status) {
                action.setLinkmanProperty(focus, 'isOnline', status.isOnline);
                action.setLinkmanProperty(focus, 'lastLoginTime', status.lastLoginTime ?? null);
            }
        }
        
        const request =
            linkman.type === 'group'
                ? fetchGroupOnlineMembers
                : fetchUserOnlineStatus;
        request();
        const timer = setInterval(() => request(), 1000 * 60);
        return () => clearInterval(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [focus, linkman?.type, isLogin, self]);

    async function intervalUpdateHistory() {
        // Must get real-time state
        const state = store.getState();
        if (
            !window.document.hidden &&
            state.focus &&
            state.linkmans[state.focus] &&
            state.user?._id
        ) {
            const messageKeys = Object.keys(
                state.linkmans[state.focus].messages,
            );
            if (messageKeys.length > 0) {
                const lastMessageId =
                    state.linkmans[state.focus].messages[
                        messageKeys[messageKeys.length - 1]
                    ]._id;
                if (lastMessageId !== lastMessageIdCache) {
                    lastMessageIdCache = lastMessageId;
                    await updateHistory(state.focus, lastMessageId);
                }
            }
        }
    }
    useEffect(() => {
        const timer = setInterval(intervalUpdateHistory, 1000 * 30);
        return () => clearInterval(timer);
    }, [focus]);

    if (!hasUserInfo) {
        return <div className={Style.chat} />;
    }
    if (!linkman) {
        return (
            <div className={Style.chat}>
                <HeaderBar
                    id=""
                    name=""
                    type=""
                    signature=""
                    tag=""
                    onClickFunction={() => {}}
                />
                <div className={Style.noLinkman}>
                    {/* <div className={Style.noLinkmanImage} /> */}
                    <h2 className={Style.noLinkmanText}>去左上角搜索一下吧~~</h2>
                </div>
            </div>
        );
    }

    async function handleClickFunction() {
        if (linkman.type === 'group') {
            let onlineMembers: GroupMember[] | { cache: true } = [];
            if (isLogin) {
                onlineMembers = await getGroupOnlineMembers(focus);
            }
            if (Array.isArray(onlineMembers)) {
                action.setLinkmanProperty(
                    focus,
                    'onlineMembers',
                    onlineMembers,
                );
            }
            toggleGroupManagePanel(true);
        } else {
            context.showUserInfo({
                ...linkman,
                username: linkman.name || (linkman as any).username,
                isOnline: linkman.isOnline,
                lastLoginTime: linkman.lastLoginTime ?? null,
            });
        }
    }

    return (
        <div className={Style.chat} {...aero}>
            <HeaderBar
                id={linkman._id}
                name={linkman.name}
                type={linkman.type}
                signature={linkman.signature}
                tag={linkman.tag}
                level={linkman.level}
                createTime={linkman.createTime}
                onlineMembersCount={linkman.onlineMembers?.length}
                totalMemberCount={linkman.membersCount}
                isOnline={linkman.isOnline}
                lastLoginTime={linkman.lastLoginTime}
                onClickFunction={handleClickFunction}
            />
            {linkman.type === 'group' && linkman.announcement ? (
                <div
                    className={Style.groupAnnouncement}
                    onClick={handleClickFunction}
                    role="button"
                >
                    <span className={Style.groupAnnouncementIcon}>📢</span>
                    <LinkifyText
                        className={Style.groupAnnouncementText}
                        linkClassName={Style.groupAnnouncementLink}
                        text={linkman.announcement}
                        stopPropagation
                    />
                </div>
            ) : null}
            {!isLogin && (
                <div className={Style.guestLoginShell}>
                    <div className={Style.guestLoginCard}>
                        <div className={Style.guestLoginHeader}>
                            <div className={Style.guestLoginEyebrow}>Bulita</div>
                            <h2 className={Style.guestLoginTitle}>登录后继续聊天</h2>
                            <p className={Style.guestLoginDesc}>
                                使用 Google 登录后，你将获得更完整的 AI 回复体验，并可上传图片、文件和管理个人信息。
                            </p>
                        </div>
                        <GoogleLogin
                            className={Style.guestLoginButton}
                            maxWidth={560}
                            minWidth={460}
                            compact
                        />
                    </div>
                </div>
            )}
            <MessageList
                onRetry={(linkmanId, messageId) =>
                    action.setStatus('pendingRetryMessage', {
                        linkmanId,
                        messageId,
                    })
                }
            />
            {isLogin && <ChatInput />}

            {linkman.type === 'group' && (
                <GroupManagePanel
                    visible={groupManagePanel}
                    onClose={() => toggleGroupManagePanel(false)}
                    groupId={linkman._id}
                    name={linkman.name}
                    avatar={linkman.avatar}
                    announcement={linkman.announcement || ''}
                    allowJoin={linkman.allowJoin !== false}
                    isDefault={linkman.isDefault === true}
                    creator={linkman.creator}
                    onlineMembers={linkman.onlineMembers}
                />
            )}
        </div>
    );
}

export default Chat;
