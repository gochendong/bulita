import React, { useState, useContext, useEffect } from 'react';
import { useSelector } from 'react-redux';

import readDiskFIle from '../../utils/readDiskFile';
import uploadFile, { getOSSFileUrl } from '../../utils/uploadFile';
import Style from './GroupManagePanel.less';
import useIsLogin from '../../hooks/useIsLogin';
import { State, GroupMember } from '../../state/reducer';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Message from '../../components/Message';
import Avatar from '../../components/Avatar';
import UserBadge from '../../components/UserBadge';
import Tooltip from '../../components/Tooltip';
import Dialog from '../../components/Dialog';
import {
    changeGroupName,
    changeGroupAvatar,
    changeGroupAnnouncement,
    deleteGroup,
    leaveGroup,
    getGroupAllMembers,
    GroupAllMemberItem,
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
    creator: string;
    onlineMembers: GroupMember[];
}

function GroupManagePanel(props: GroupManagePanelProps) {
    const { visible, onClose, groupId, name, avatar, announcement, creator, onlineMembers } = props;

    const action = useAction();
    const isLogin = useIsLogin();
    const selfId = useSelector((state: State) => state.user?._id);
    const [deleteConfirmDialog, setDialogStatus] = useState(false);
    const [groupName, setGroupName] = useState(name);
    const [groupAnnouncement, setGroupAnnouncement] = useState(announcement);
    const [allMembers, setAllMembers] = useState<GroupAllMemberItem[]>([]);
    const context = useContext(ShowUserOrGroupInfoContext);

    useEffect(() => {
        if (visible) {
            setGroupName(name);
            setGroupAnnouncement(announcement);
            getGroupAllMembers(groupId).then((members) => {
                const sorted = [...members].sort((a, b) => {
                    if (a.isCreator) return -1;
                    if (b.isCreator) return 1;
                    if (a.isOnline && !b.isOnline) return -1;
                    if (!a.isOnline && b.isOnline) return 1;
                    // 离线成员按最后离线时间排序，最后离线的排在上面
                    const timeA = a.user.lastLoginTime ? new Date(a.user.lastLoginTime).getTime() : 0;
                    const timeB = b.user.lastLoginTime ? new Date(b.user.lastLoginTime).getTime() : 0;
                    return timeB - timeA;
                });
                setAllMembers(sorted);
            });
        }
    }, [visible, name, announcement, groupId]);

    async function handleChangeGroupName() {
        if (!groupName.trim() || groupName === name) return;
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
            setDialogStatus(false);
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
    const onlineMembersList = allMembers.filter((m) => !m.isCreator && m.isOnline);
    const offlineMembersList = allMembers.filter((m) => !m.isCreator && !m.isOnline);

    function renderMemberRow(member: GroupAllMemberItem) {
        const { user: u } = member;
        return (
            <div
                key={u._id}
                className={Style.memberRow}
            >
                <div
                    className={Style.userinfoBlock}
                    onClick={() => handleShowUserInfo(u)}
                    role="button"
                >
                    <Avatar size={28} src={u.avatar} />
                    <div className={Style.memberInfo}>
                        <p className={Style.username}>
                            {u.username}
                            <UserBadge createTime={u.createTime} />
                            {member.isCreator && (
                                <span className={Style.creatorTag}>群主</span>
                            )}
                            {member.isOnline && !member.isCreator && (
                                <span className={Style.onlineTag}>在线</span>
                            )}
                        </p>
                        <p className={Style.memberTime}>
                            {member.isOnline
                                ? '当前在线'
                                : `离线于 ${formatTime(u.lastLoginTime)}`}
                        </p>
                    </div>
                </div>
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
                                    className={Style.input}
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
                            <Input
                                className={Style.input}
                                value={groupAnnouncement}
                                onChange={setGroupAnnouncement}
                                onBlur={handleChangeGroupAnnouncement}
                                placeholder="设置群公告，成员将在聊天顶部看到"
                            />
                        </div>
                    ) : announcement ? (
                        <div className={Style.block}>
                            <p className={Style.blockTitle}>群公告</p>
                            <p className={Style.announcementText}>{announcement}</p>
                        </div>
                    ) : null}
                    {isLogin && selfId === creator ? (
                        <div className={Style.block}>
                            <p className={Style.blockTitle}>群头像</p>
                            <img
                                className={Style.avatar}
                                src={getOSSFileUrl(avatar)}
                                alt="群头像预览"
                                onClick={handleChangeGroupAvatar}
                            />
                        </div>
                    ) : null}

                    <div className={Style.block}>
                        <p className={Style.blockTitle}>功能</p>
                        {selfId === creator ? (
                            <button
                                type="button"
                                className={Style.dissolveGroupBtn}
                                onClick={() => setDialogStatus(true)}
                            >
                                解散群组
                            </button>
                        ) : (
                            <Button
                                className={Style.button}
                                type="danger"
                                onClick={handleLeaveGroup}
                            >
                                退出群组
                            </Button>
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
                    <Dialog
                        className={Style.deleteGroupConfirmDialog}
                        title="再次确认是否解散群组?"
                        visible={deleteConfirmDialog}
                        onClose={() => setDialogStatus(false)}
                    >
                        <Button
                            className={Style.deleteGroupConfirmButton}
                            type="danger"
                            onClick={handleDeleteGroup}
                        >
                            确认
                        </Button>
                        <Button
                            className={Style.deleteGroupConfirmButton}
                            onClick={() => setDialogStatus(false)}
                        >
                            取消
                        </Button>
                    </Dialog>
                </div>
            </div>
        </div>
    );
}

export default GroupManagePanel;
