import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';

import getFriendId from '@bulita/utils/getFriendId';
import { getAvatarUrl } from '../utils/uploadFile';
import Style from './InfoDialog.less';
import Dialog from '../components/Dialog';
import Avatar from '../components/Avatar';
import Button from '../components/Button';
import Message from '../components/Message';
import { State, Linkman } from '../state/reducer';
import useAction from '../hooks/useAction';
import {
    addFriend,
    getLinkmanHistoryMessages,
    deleteFriend,
    sealUser,
    getUserOnlineStatus,
} from '../service';

interface UserInfoProps {
    visible: boolean;
    user?: {
        _id: string;
        username: string;
        avatar: string;
        isOnline?: boolean;
        lastLoginTime?: string | null;
        email: string;
        level: number;
        signature: string;
        tag?: string;
    };
    onClose: () => void;
}

function UserInfo(props: UserInfoProps) {
    const { visible, onClose, user } = props;

    const action = useAction();

    const selfId =
        useSelector((state: State) => state.user && state.user._id) || '';
    // 获取好友id
    if (user && user._id.length === selfId.length) {
        user._id = getFriendId(selfId, user._id);
    }
    /** 获取原始用户id */
    const originUserId = user && user._id.replace(selfId, '');

    // @ts-ignore
    const linkman = useSelector((state: State) => state.linkmans[user?._id]);
    const isFriend = linkman && linkman.type === 'friend';
    const isAdmin = useSelector(
        (state: State) => state.user && state.user.isAdmin,
    );
    const [largerAvatar, toggleLargetAvatar] = useState(false);

    /** 管理员查看时拉取的在线/最后在线（即使用户不是好友也能看到） */
    const [adminOnlineStatus, setAdminOnlineStatus] = useState<{ isOnline: boolean; lastLoginTime: string | null } | null>(null);

    useEffect(() => {
        if (!visible || !user || !isAdmin) {
            setAdminOnlineStatus(null);
            return;
        }
        const rawUserId = user._id.replace(selfId, '');
        if (!rawUserId) return;
        getUserOnlineStatus(rawUserId).then((status) => {
            if (status) {
                setAdminOnlineStatus({
                    isOnline: status.isOnline,
                    lastLoginTime: status.lastLoginTime ?? null,
                });
            }
        });
    }, [visible, user, isAdmin, selfId]);

    if (!user) {
        return null;
    }

    function handleFocusUser() {
        onClose();
        // @ts-ignore
        action.setFocus(user._id);
    }

    async function handleAddFriend() {
        // @ts-ignore
        const friend = await addFriend(originUserId);
        if (friend) {
            onClose();
            // @ts-ignore
            const { _id } = user;
            let existCount = 0;
            if (linkman) {
                existCount = Object.keys(linkman.messages).length;
                action.setLinkmanProperty(_id, 'type', 'friend');
            } else {
                const newLinkman = {
                    _id,
                    from: selfId,
                    to: {
                        _id: originUserId,
                        username: friend.username,
                        avatar: friend.avatar,
                    },
                    type: 'friend',
                    createTime: Date.now(),
                };
                action.addLinkman(newLinkman as unknown as Linkman, true);
            }
            const messages = await getLinkmanHistoryMessages(_id, existCount);
            if (messages) {
                action.addLinkmanHistoryMessages(_id, messages);
            }
            handleFocusUser();
        }
    }

    async function handleDeleteFriend() {
        // @ts-ignore
        const isSuccess = await deleteFriend(originUserId);
        if (isSuccess) {
            onClose();
            // @ts-ignore
            action.removeLinkman(user._id);
            Message.success('删除聊天成功');
        }
    }

    async function handleSeal() {
        // @ts-ignore
        const isSuccess = await sealUser(user.name || user.username);
        if (isSuccess) {
            Message.success('封禁用户成功');
        }
    }

    function formatLastOnline(dateStr: string | null): string {
        if (!dateStr) return '从未登录';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffM = Math.floor(diffMs / 60000);
        const diffH = Math.floor(diffMs / 3600000);
        const diffD = Math.floor(diffMs / 86400000);
        if (diffM < 1) return '刚刚';
        if (diffM < 60) return `${diffM} 分钟前`;
        if (diffH < 24) return `${diffH} 小时前`;
        if (diffD < 30) return `${diffD} 天前`;
        return date.toLocaleDateString();
    }

    function handleClose() {
        toggleLargetAvatar(false);
        onClose();
    }

    return (
        <Dialog
            className={Style.infoDialog}
            visible={visible}
            onClose={handleClose}
        >
            <div>
                {visible && user ? (
                    <div className={Style.coantainer}>
                        <div className={Style.header}>
                            <Avatar
                                size={60}
                                src={user.avatar}
                                onMouseEnter={() => toggleLargetAvatar(true)}
                                onMouseLeave={() => toggleLargetAvatar(false)}
                            />
                            <img
                                className={`${Style.largeAvatar} ${
                                    largerAvatar ? 'show' : 'hide'
                                }`}
                                src={getAvatarUrl(user.avatar)}
                                alt="用户头像"
                            />
                            <p>{user.username}</p>
                            {(() => {
                                const isOnline = adminOnlineStatus?.isOnline ?? user.isOnline;
                                const lastLoginTime = adminOnlineStatus?.lastLoginTime ?? user.lastLoginTime;
                                if (user.tag === 'bot' || isOnline === true) {
                                    return <p className={Style.onlineStatus}>当前在线</p>;
                                }
                                if (lastLoginTime != null) {
                                    return (
                                        <p className={Style.lastOnline}>
                                            最后在线：{formatLastOnline(lastLoginTime)}
                                        </p>
                                    );
                                }
                                return null;
                            })()}
                        </div>
                        <div className={Style.info}>
                            {isFriend ? (
                                <Button onClick={handleFocusUser}>
                                    发送消息
                                </Button>
                            ) : null}
                            {isFriend ? (
                                <Button
                                    type="danger"
                                    onClick={handleDeleteFriend}
                                >
                                    删除聊天
                                </Button>
                            ) : (
                                <Button onClick={handleAddFriend}>
                                    开始聊天
                                </Button>
                            )}
                            {isAdmin ? (
                                <Button type="danger" onClick={handleSeal}>
                                    封禁用户
                                </Button>
                            ) : null}
                        </div>
                    </div>
                ) : null}
            </div>
        </Dialog>
    );
}

export default UserInfo;
