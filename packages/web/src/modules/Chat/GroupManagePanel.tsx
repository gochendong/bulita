import React, { useState, useContext, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import Switch from 'react-switch';

import readDiskFIle from '../../utils/readDiskFile';
import uploadFile, { getAvatarUrl } from '../../utils/uploadFile';
import Style from './GroupManagePanel.less';
import useIsLogin from '../../hooks/useIsLogin';
import { State, GroupMember } from '../../state/reducer';
import Input from '../../components/Input';
import Message from '../../components/Message';
import Avatar from '../../components/Avatar';
import LinkifyText from '../../components/LinkifyText';
import UserBadge from '../../components/UserBadge';
import ConfirmDialog from '../../components/ConfirmDialog';
import {
    changeGroupName,
    changeGroupAvatar,
    changeGroupAnnouncement,
    changeGroupAllowJoin,
    changeGroupAIEnabled,
    changeGroupMute,
    deleteGroup,
    leaveGroup,
    getGroupAllMembers,
    getGroupOnlineMembers,
    GroupAllMemberItem,
    addGroupMember,
    kickGroupMember,
    transferGroupCreator,
    search,
} from '../../service';
import useAction from '../../hooks/useAction';
import config from '../../../../config/client';
import { ShowUserOrGroupInfoContext } from '../../context';

interface GroupManagePanelProps {
    visible: boolean;
    onClose: () => void;
    groupId: string;
    name: string;
    avatar: string;
    announcement: string;
    allowJoin: boolean;
    aiEnabled: boolean;
    muted: boolean;
    isDefault: boolean;
    creator: string;
    onlineMembers: GroupMember[];
}

function GroupManagePanel(props: GroupManagePanelProps) {
    const {
        visible,
        onClose,
        groupId,
        name,
        avatar,
        announcement,
        allowJoin,
        aiEnabled,
        muted,
        isDefault,
        creator,
        onlineMembers,
    } = props;

    const action = useAction();
    const isLogin = useIsLogin();
    const selfId = useSelector((state: State) => state.user?._id);
    const [confirmDialog, setConfirmDialog] = useState<{
        title: string;
        description?: string;
        confirmText?: string;
        confirmType?: string;
        onConfirm: () => Promise<void> | void;
    } | null>(null);
    const [groupName, setGroupName] = useState(name);
    const [groupAnnouncement, setGroupAnnouncement] = useState(announcement);
    const [groupAllowJoin, setGroupAllowJoin] = useState(allowJoin);
    const [groupAIEnabled, setGroupAIEnabled] = useState(aiEnabled);
    const [groupMuted, setGroupMuted] = useState(muted);
    const [allMembers, setAllMembers] = useState<GroupAllMemberItem[]>([]);
    const [memberKeywords, setMemberKeywords] = useState('');
    const [memberSearchResult, setMemberSearchResult] = useState<any[]>([]);
    const memberKeywordsRef = useRef(memberKeywords);
    const memberSearchTimerRef = useRef<number | null>(null);
    const announcementFieldNameRef = useRef(
        `bulita-textarea-${Math.random().toString(36).slice(2, 10)}`,
    );
    const [announcementReadonly, setAnnouncementReadonly] = useState(true);
    const context = useContext(ShowUserOrGroupInfoContext);
    const isOwner = isLogin && !!selfId && selfId === creator;
    const canManageMembers = isOwner && !isDefault;
    const canTransferOwner = isOwner;

    function sortMembers(members: GroupAllMemberItem[]) {
        return [...members].sort((a, b) => {
            if (a.isCreator) return -1;
            if (b.isCreator) return 1;
            const aOnline = a.isOnline || a.user.tag === 'bot';
            const bOnline = b.isOnline || b.user.tag === 'bot';
            if (aOnline && !bOnline) return -1;
            if (!aOnline && bOnline) return 1;
            const timeA = a.user.lastLoginTime
                ? new Date(a.user.lastLoginTime).getTime()
                : 0;
            const timeB = b.user.lastLoginTime
                ? new Date(b.user.lastLoginTime).getTime()
                : 0;
            return timeB - timeA;
        });
    }

    async function loadMembers() {
        const members = await getGroupAllMembers(groupId);
        setAllMembers(sortMembers(members));
    }

    useEffect(() => {
        if (visible) {
            setGroupName(name);
            setGroupAnnouncement(announcement);
            setGroupAllowJoin(allowJoin);
            setGroupAIEnabled(aiEnabled);
            setGroupMuted(muted);
            setMemberKeywords('');
            setMemberSearchResult([]);
            loadMembers();
        }
    }, [visible, name, announcement, allowJoin, aiEnabled, muted, groupId]);

    useEffect(() => {
        memberKeywordsRef.current = memberKeywords;
    }, [memberKeywords]);

    useEffect(() => {
        if (!visible || !canManageMembers) {
            return undefined;
        }

        if (memberSearchTimerRef.current) {
            clearTimeout(memberSearchTimerRef.current);
        }

        const keywords = memberKeywords.trim();
        if (!keywords) {
            setMemberSearchResult([]);
            return undefined;
        }

        memberSearchTimerRef.current = window.setTimeout(async () => {
            const result = await search(keywords);
            if (memberKeywordsRef.current.trim() !== keywords) {
                return;
            }

            const memberIds = new Set(allMembers.map((item) => item.user._id));
            const users = (result?.users || []).filter(
                (item: any) => !memberIds.has(item._id),
            );
            setMemberSearchResult(users);
        }, 1000);

        return () => {
            if (memberSearchTimerRef.current) {
                clearTimeout(memberSearchTimerRef.current);
            }
        };
    }, [memberKeywords, visible, canManageMembers, allMembers]);

    async function handleChangeGroupName() {
        if (!groupName.trim()) {
            setGroupName(name);
            return;
        }
        if (groupName.trim() === name) return;
        const isSuccess = await changeGroupName(groupId, groupName.trim());
        if (isSuccess) {
            Message.success('群名称已更新');
            action.setLinkmanProperty(groupId, 'name', groupName.trim());
        }
    }

    async function handleChangeGroupAnnouncement() {
        if (groupAnnouncement === announcement) return;
        const isSuccess = await changeGroupAnnouncement(groupId, groupAnnouncement.trim());
        if (isSuccess) {
            Message.success('群公告已更新');
            action.setLinkmanProperty(groupId, 'announcement', groupAnnouncement.trim());
        }
    }

    async function handleChangeGroupAllowJoin(nextAllowJoin: boolean) {
        setGroupAllowJoin(nextAllowJoin);
        const isSuccess = await changeGroupAllowJoin(groupId, nextAllowJoin);
        if (isSuccess) {
            action.setLinkmanProperty(groupId, 'allowJoin', nextAllowJoin);
            Message.success(nextAllowJoin ? '已允许新成员加入' : '已禁止新成员加入');
            return;
        }
        setGroupAllowJoin(!nextAllowJoin);
    }

    async function handleChangeGroupAI(nextAIEnabled: boolean) {
        setGroupAIEnabled(nextAIEnabled);
        const isSuccess = await changeGroupAIEnabled(groupId, nextAIEnabled);
        if (isSuccess) {
            action.setLinkmanProperty(groupId, 'aiEnabled', nextAIEnabled);
            const onlineMembers = await getGroupOnlineMembers(groupId);
            if (Array.isArray(onlineMembers)) {
                action.setLinkmanProperty(groupId, 'onlineMembers', onlineMembers);
            }
            loadMembers();
            Message.success(nextAIEnabled ? '已开启当前群组 AI' : '已关闭当前群组 AI');
            return;
        }
        setGroupAIEnabled(!nextAIEnabled);
    }

    async function handleChangeGroupMute(nextMuted: boolean) {
        setGroupMuted(nextMuted);
        const result = await changeGroupMute(groupId, nextMuted);
        if (result) {
            action.setLinkmanProperty(groupId, 'muted', nextMuted);
            if (nextMuted) {
                action.setLinkmanProperty(groupId, 'unread', 0);
            }
            Message.success(nextMuted ? '已开启群消息免打扰' : '已关闭群消息免打扰');
            return;
        }
        setGroupMuted(!nextMuted);
    }

    async function handleChangeGroupAvatar() {
        const image = await readDiskFIle(
            'blob',
            'image/png,image/jpeg,image/gif',
        );
        if (!image) {
            return;
        }
        if (image.length > config.maxAvatarSize) {
            // eslint-disable-next-line consistent-return
            return Message.error('选择的图片过大');
        }

        try {
            const imageUrl = await uploadFile(
                image.result as Blob,
                `GroupAvatar/${selfId}_${Date.now()}.${image.ext}`,
            );
            const isSuccess = await changeGroupAvatar(groupId, imageUrl);
            if (isSuccess) {
                action.setLinkmanProperty(
                    groupId,
                    'avatar',
                    URL.createObjectURL(image.result),
                );
                Message.success('群头像已更新');
            }
        } catch (err) {
            console.error(err);
            Message.error('上传群头像失败');
        }
    }

    async function handleDeleteGroup() {
        const isSuccess = await deleteGroup(groupId);
        if (isSuccess) {
            onClose();
            action.removeLinkman(groupId);
            Message.success('解散群组成功');
        }
    }

    async function handleLeaveGroup() {
        const isSuccess = await leaveGroup(groupId);
        if (isSuccess) {
            onClose();
            action.removeLinkman(groupId);
            Message.success('退出群组成功');
        }
    }

    async function handleAddMember(user: any) {
        const result = await addGroupMember(groupId, user._id);
        if (result) {
            action.setLinkmanProperty(groupId, 'membersCount', result.membersCount);
            Message.success(`已将 ${user.username} 拉入群组`);
            setMemberSearchResult((prev) =>
                prev.filter((item) => item._id !== user._id),
            );
            setMemberKeywords('');
            loadMembers();
        }
    }

    async function handleKickMember(member: GroupAllMemberItem) {
        const username = member.user.username || '该成员';
        setConfirmDialog({
            title: '确认移出成员',
            description: `将 ${username} 移出当前群组后，对方会立即失去该群访问权限。`,
            confirmText: '确认移出',
            onConfirm: async () => {
                const result = await kickGroupMember(groupId, member.user._id);
                if (result) {
                    action.setLinkmanProperty(
                        groupId,
                        'membersCount',
                        result.membersCount,
                    );
                    Message.success(`已将 ${username} 移出群组`);
                    loadMembers();
                }
            },
        });
    }

    async function handleTransferCreator(member: GroupAllMemberItem) {
        const username = member.user.username || '该成员';
        setConfirmDialog({
            title: '确认转让管理员',
            description: `转让后 ${username} 将成为新的管理员，你将失去当前群组的管理权限。`,
            confirmText: '确认转让',
            confirmType: 'primary',
            onConfirm: async () => {
                const isSuccess = await transferGroupCreator(
                    groupId,
                    member.user._id,
                );
                if (isSuccess) {
                    action.setLinkmanProperty(groupId, 'creator', member.user._id);
                    Message.success(`已将管理员转让给 ${username}`);
                    loadMembers();
                }
            },
        });
    }

    async function handleConfirmAction() {
        const currentAction = confirmDialog?.onConfirm;
        setConfirmDialog(null);
        if (currentAction) {
            await currentAction();
        }
    }

    function handlePrepareAnnouncementInput() {
        if (announcementReadonly) {
            setAnnouncementReadonly(false);
        }
    }

    function handleClickMask(e: React.MouseEvent) {
        if (e.target === e.currentTarget) {
            onClose();
        }
    }

    function handleShowUserInfo(userInfo: any) {
        if (userInfo._id === selfId) {
            return;
        }
        // @ts-ignore
        context.showUserInfo(userInfo);
        onClose();
    }

    function formatTime(dateStr: string | null): string {
        if (!dateStr) return '从未登录';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffM = Math.floor(diffMs / 60000);
        const diffH = Math.floor(diffMs / 3600000);
        const diffD = Math.floor(diffMs / 86400000);
        if (diffM < 1) return '刚刚';
        if (diffM < 60) return `${diffM}分钟前`;
        if (diffH < 24) return `${diffH}小时前`;
        if (diffD < 30) return `${diffD}天前`;
        return date.toLocaleDateString();
    }

    const ownerMembers = allMembers.filter((m) => m.isCreator);
    const onlineMembersList = allMembers.filter((m) => !m.isCreator && (m.isOnline || m.user.tag === 'bot'));
    const offlineMembersList = allMembers.filter((m) => !m.isCreator && !m.isOnline && m.user.tag !== 'bot');

    function renderMemberRow(member: GroupAllMemberItem) {
        const { user: u } = member;
        const isOnline = member.isOnline || u.tag === 'bot';
        const showTransferButton =
            canTransferOwner &&
            !member.isCreator &&
            u.tag !== 'bot';
        const showKickButton =
            canManageMembers &&
            !member.isCreator &&
            u._id !== selfId;
        return (
            <div
                key={u._id}
                className={Style.memberRow}
            >
                <div
                    className={Style.userinfoBlock}
                    onClick={() => handleShowUserInfo({ ...u, isOnline, lastLoginTime: (member as any).lastLoginTime ?? u.lastLoginTime })}
                    role="button"
                >
                    <Avatar size={28} src={u.avatar} />
                    <div className={Style.memberInfo}>
                        <p className={Style.username}>
                            {u.username}
                            {u.tag !== 'bot' && u.createTime && (
                                <UserBadge createTime={u.createTime} />
                            )}
                            {member.isCreator && (
                                <span className={Style.creatorTag}>群主</span>
                            )}
                            {isOnline && !member.isCreator && (
                                <span className={Style.onlineTag}>在线</span>
                            )}
                        </p>
                        {!isOnline && (
                            <p className={Style.memberTime}>
                                离线于 {formatTime(u.lastLoginTime)}
                            </p>
                        )}
                    </div>
                </div>
                {(showTransferButton || showKickButton) && (
                    <div className={Style.memberActions}>
                        {showTransferButton && (
                            <button
                                type="button"
                                className={Style.memberActionButton}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    handleTransferCreator(member);
                                }}
                            >
                                转让管理员
                            </button>
                        )}
                        {showKickButton && (
                            <button
                                type="button"
                                className={`${Style.memberActionButton} ${Style.memberActionDanger}`}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    handleKickMember(member);
                                }}
                            >
                                踢出
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div
            className={`${Style.groupManagePanel} ${visible ? 'show' : 'hide'}`}
            onClick={handleClickMask}
            role="button"
            data-float-panel="true"
        >
            <div
                className={`${Style.container} ${
                    visible ? Style.show : Style.hide
                }`}
            >
                <p className={Style.title}>群组信息</p>
                <div className={Style.content}>
                    {isLogin && selfId === creator ? (
                        <div className={Style.block}>
                            <p className={Style.blockTitle}>群名称</p>
                            <div className={Style.name}>
                                <Input
                                    className={Style.inputWrap}
                                    value={groupName}
                                    onChange={setGroupName}
                                    onBlur={handleChangeGroupName}
                                />
                            </div>
                        </div>
                    ) : null}
                    {isLogin && selfId === creator ? (
                        <div className={Style.block}>
                            <p className={Style.blockTitle}>群公告</p>
                            <textarea
                                className={Style.announcementInput}
                                value={groupAnnouncement}
                                onChange={(event) => setGroupAnnouncement(event.target.value)}
                                onFocus={() => setAnnouncementReadonly(false)}
                                onBlur={() => {
                                    setAnnouncementReadonly(true);
                                    handleChangeGroupAnnouncement();
                                }}
                                placeholder="设置群公告，成员将在聊天顶部看到"
                                autoComplete="new-password"
                                autoCorrect="off"
                                autoCapitalize="off"
                                spellCheck={false}
                                autoSave="off"
                                aria-autocomplete="none"
                                data-form-type="other"
                                data-lpignore="true"
                                data-1p-ignore="true"
                                name={announcementFieldNameRef.current}
                                readOnly={announcementReadonly}
                                onMouseDown={handlePrepareAnnouncementInput}
                                onTouchStart={handlePrepareAnnouncementInput}
                                rows={4}
                            />
                        </div>
                    ) : announcement ? (
                        <div className={Style.block}>
                            <p className={Style.blockTitle}>群公告</p>
                            <LinkifyText
                                className={Style.announcementText}
                                linkClassName={Style.announcementLink}
                                text={announcement}
                            />
                        </div>
                    ) : null}
                    {isLogin && selfId === creator ? (
                        <div className={Style.block}>
                            <p className={Style.blockTitle}>群头像</p>
                            <img
                                className={Style.avatar}
                                src={getAvatarUrl(avatar)}
                                alt="群头像预览"
                                onClick={handleChangeGroupAvatar}
                            />
                        </div>
                    ) : null}

                    {canManageMembers && (
                        <div className={Style.block}>
                            <p className={Style.blockTitle}>新成员加入</p>
                            <div className={Style.joinSwitchRow}>
                                <span className={Style.joinSwitchText}>
                                    {groupAllowJoin ? '允许任何人加入' : '禁止主动加入'}
                                </span>
                                <Switch
                                    onColor="#52d88a"
                                    offColor="#d4d4d8"
                                    uncheckedIcon={false}
                                    checkedIcon={false}
                                    checked={groupAllowJoin}
                                    onChange={handleChangeGroupAllowJoin}
                                />
                            </div>
                        </div>
                    )}

                    {isOwner && (
                        <div className={Style.block}>
                            <p className={Style.blockTitle}>群聊 AI</p>
                            <div className={Style.joinSwitchRow}>
                                <span className={Style.joinSwitchText}>
                                    {groupAIEnabled ? '当前群组已开启 AI 回复' : '当前群组已关闭 AI 回复'}
                                </span>
                                <Switch
                                    onColor="#52d88a"
                                    offColor="#d4d4d8"
                                    uncheckedIcon={false}
                                    checkedIcon={false}
                                    checked={groupAIEnabled}
                                    onChange={handleChangeGroupAI}
                                />
                            </div>
                        </div>
                    )}

                    <div className={Style.block}>
                        <p className={Style.blockTitle}>消息免打扰</p>
                        <div className={Style.joinSwitchRow}>
                            <span className={Style.joinSwitchText}>
                                消息免打扰
                            </span>
                            <Switch
                                onColor="#52d88a"
                                offColor="#d4d4d8"
                                uncheckedIcon={false}
                                checkedIcon={false}
                                checked={groupMuted}
                                onChange={handleChangeGroupMute}
                            />
                        </div>
                    </div>

                    {canManageMembers && (
                        <div className={Style.block}>
                            <p className={Style.blockTitle}>拉人进群</p>
                            <div className={Style.memberSearchRow}>
                                <Input
                                    className={Style.memberSearchInput}
                                    value={memberKeywords}
                                    onChange={setMemberKeywords}
                                    placeholder="搜索邮箱或用户名"
                                />
                            </div>
                            {memberSearchResult.length > 0 && (
                                <div className={Style.memberSearchList}>
                                    {memberSearchResult.map((user) => (
                                        <div
                                            key={user._id}
                                            className={Style.memberSearchItem}
                                        >
                                            <div className={Style.memberSearchUser}>
                                                <Avatar size={28} src={user.avatar} />
                                                <span>{user.username}</span>
                                            </div>
                                            <button
                                                type="button"
                                                className={Style.memberActionButton}
                                                onClick={() => handleAddMember(user)}
                                            >
                                                拉入
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div className={Style.block}>
                        <p className={Style.blockTitle}>功能</p>
                        {isDefault && selfId === creator ? (
                            <p className={Style.functionHint}>
                                默认群组不可解散，可通过成员列表转让管理员
                            </p>
                        ) : selfId === creator ? (
                            <button
                                type="button"
                                className={Style.dissolveGroupBtn}
                                onClick={() =>
                                    setConfirmDialog({
                                        title: '确认解散群组',
                                        description:
                                            '解散后群消息和成员关系将被移除，该操作不可恢复。',
                                        confirmText: '确认解散',
                                        onConfirm: handleDeleteGroup,
                                    })
                                }
                            >
                                解散群组
                            </button>
                        ) : (
                            <button
                                type="button"
                                className={Style.leaveGroupBtn}
                                onClick={handleLeaveGroup}
                            >
                                退出群组
                            </button>
                        )}
                    </div>
                    <div className={Style.block}>
                        <p className={Style.blockTitle}>
                            所有成员 &nbsp;<span>{allMembers.length}</span>
                        </p>
                        <div className={Style.memberList}>
                            {ownerMembers.length > 0 && (
                                <>
                                    <p className={Style.memberSectionTitle}>群主</p>
                                    {ownerMembers.map(renderMemberRow)}
                                </>
                            )}
                            {onlineMembersList.length > 0 && (
                                <>
                                    <p className={Style.memberSectionTitle}>
                                        在线成员 &nbsp;{onlineMembersList.length}
                                    </p>
                                    {onlineMembersList.map(renderMemberRow)}
                                </>
                            )}
                            {offlineMembersList.length > 0 && (
                                <>
                                    <p className={Style.memberSectionTitle}>
                                        离线成员 &nbsp;{offlineMembersList.length}
                                    </p>
                                    {offlineMembersList.map(renderMemberRow)}
                                </>
                            )}
                        </div>
                    </div>
                    <ConfirmDialog
                        visible={!!confirmDialog}
                        title={confirmDialog?.title || ''}
                        description={confirmDialog?.description}
                        confirmText={confirmDialog?.confirmText}
                        confirmType={confirmDialog?.confirmType}
                        onConfirm={handleConfirmAction}
                        onClose={() => setConfirmDialog(null)}
                    />
                </div>
            </div>
        </div>
    );
}

export default GroupManagePanel;
