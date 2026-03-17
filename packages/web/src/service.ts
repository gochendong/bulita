import fetch from './utils/fetch';
import { User, GroupMember } from './state/reducer';

function saveUsername(username: string) {
    // window.localStorage.setItem('username', username);
}

/**
 * 使用 Google ID Token 登录
 * @param credential Google credential
 * @param os 系统
 * @param browser 浏览器
 * @param environment 环境信息
 */
export async function loginWithGoogle(
    credential: string,
    os = '',
    browser = '',
    environment = '',
) {
    const [err, user] = await fetch('googleLogin', {
        credential,
        os,
        browser,
        environment,
    });

    if (err) {
        return null;
    }
    return user;
}

/**
 * 使用token登录
 * @param token 登录token
 * @param os 系统
 * @param browser 浏览器
 * @param environment 环境信息
 */
export async function loginByToken(
    token: string,
    os = '',
    browser = '',
    environment = '',
) {
    const [err, user] = await fetch(
        'loginByToken',
        {
            token,
            os,
            browser,
            environment,
        },
        { toast: false },
    );

    if (err) {
        window.localStorage.removeItem('token');
        return null;
    }
    return user;
}

/**
 * 游客模式登陆
 * @param os 系统
 * @param browser 浏览器
 * @param environment 环境信息
 */
export async function guest(os = '', browser = '', environment = '') {
    const [err, res] = await fetch('guest', { os, browser, environment });
    if (err) {
        return null;
    }
    return res;
}

/**
 * 修用户头像
 * @param avatar 新头像链接
 */
export async function changeAvatar(avatar: string) {
    const [error] = await fetch('changeAvatar', { avatar });
    return !error;
}

/**
 * 修改用户名
 * @param username 新用户名
 */
export async function changeUsername(username: string) {
    const [error] = await fetch('changeUsername', {
        username,
    });
    return !error;
}

/**
 * 修改个性签名
 * @param signature 新个性签名
 */
export async function changeSignature(signature: string) {
    const [error] = await fetch('changeSignature', {
        signature,
    });
    return !error;
}

/**
 * 修改私聊通知token
 * @param pushToken 新私聊通知token
 */
export async function changePushToken(pushToken: string) {
    const [error] = await fetch('changePushToken', {
        pushToken,
    });
    return !error;
}

export async function changeAIConfig(
    aiApiKey: string,
    aiBaseUrl: string,
    aiModel: string,
    aiContextCount: string | number,
) {
    const [error, data] = await fetch('changeAIConfig', {
        aiApiKey,
        aiBaseUrl,
        aiModel,
        aiContextCount,
    });
    if (error) {
        return null;
    }
    return data;
}

export async function changePrivacySettings(
    rejectPrivateChat: boolean,
    rejectGroupInvite: boolean,
) {
    const [error, data] = await fetch('changePrivacySettings', {
        rejectPrivateChat,
        rejectGroupInvite,
    });
    if (error) {
        return null;
    }
    return data;
}

/**
 * 修改群组名
 * @param groupId 目标群组
 * @param name 新名字
 */
export async function changeGroupName(groupId: string, name: string) {
    const [error] = await fetch('changeGroupName', { groupId, name });
    return !error;
}

/**
 * 修改群头像
 * @param groupId 目标群组
 * @param name 新头像
 */
export async function changeGroupAvatar(groupId: string, avatar: string) {
    const [error] = await fetch('changeGroupAvatar', { groupId, avatar });
    return !error;
}

/**
 * 修改群公告
 * @param groupId 目标群组
 * @param announcement 新公告内容
 */
export async function changeGroupAnnouncement(
    groupId: string,
    announcement: string,
) {
    const [error] = await fetch('changeGroupAnnouncement', {
        groupId,
        announcement,
    });
    return !error;
}

/**
 * 创建群组
 * @param name 群组名
 */
export async function createGroup(name: string) {
    const [, group] = await fetch('createGroup', { name });
    return group;
}

/**
 * 删除群组
 * @param groupId 群组id
 */
export async function deleteGroup(groupId: string) {
    const [error] = await fetch('deleteGroup', { groupId });
    return !error;
}

/**
 * 加入群组
 * @param groupId 群组id
 */
export async function joinGroup(groupId: string) {
    const [, group] = await fetch('joinGroup', { groupId });
    return group;
}

export async function addGroupMember(groupId: string, userId: string) {
    const [error, result] = await fetch('addGroupMember', { groupId, userId });
    if (error) {
        return null;
    }
    return result;
}

export async function kickGroupMember(groupId: string, userId: string) {
    const [error, result] = await fetch('kickGroupMember', { groupId, userId });
    if (error) {
        return null;
    }
    return result;
}

export async function transferGroupCreator(groupId: string, userId: string) {
    const [error] = await fetch('transferGroupCreator', { groupId, userId });
    return !error;
}

export async function changeGroupAllowJoin(
    groupId: string,
    allowJoin: boolean,
) {
    const [error] = await fetch('changeGroupAllowJoin', { groupId, allowJoin });
    return !error;
}

export async function changeGroupAIEnabled(
    groupId: string,
    aiEnabled: boolean,
) {
    const [error] = await fetch('changeGroupAIEnabled', { groupId, aiEnabled });
    return !error;
}

export async function changeGroupMute(groupId: string, muted: boolean) {
    const [error, result] = await fetch('changeGroupMute', { groupId, muted });
    if (error) {
        return null;
    }
    return result;
}

/**
 * 离开群组
 * @param groupId 群组id
 */
export async function leaveGroup(groupId: string) {
    const [error] = await fetch('leaveGroup', { groupId });
    return !error;
}

/**
 * 添加好友
 * @param userId 目标用户id
 */
export async function addFriend(userId: string) {
    const [, user] = await fetch<User>('addFriend', { userId });
    return user;
}

/**
 * 删除好友
 * @param userId 目标用户id
 */
export async function deleteFriend(userId: string) {
    const [err] = await fetch('deleteFriend', { userId });
    return !err;
}

/**
 * Get the last messages and unread number of a group of linkmans
 * @param linkmanIds Linkman ids who need to get the last messages
 */
export async function getLinkmansLastMessagesV2(linkmanIds: string[]) {
    const [, linkmanMessages] = await fetch('getLinkmansLastMessagesV2', {
        linkmans: linkmanIds,
    });
    return linkmanMessages;
}

/**
 * 获取联系人历史消息
 * @param linkmanId 联系人id
 * @param existCount 客户端已有消息条数
 */
export async function getLinkmanHistoryMessages(
    linkmanId: string,
    existCount: number,
) {
    const [, messages] = await fetch('getLinkmanHistoryMessages', {
        linkmanId,
        existCount,
    });
    return messages;
}

/**
 * 获取默认群组的历史消息
 * @param existCount 客户端已有消息条数
 */
export async function getDefaultGroupHistoryMessages(existCount: number) {
    const [, messages] = await fetch('getDefaultGroupHistoryMessages', {
        existCount,
    });
    return messages;
}

/**
 * 搜索用户和群组
 * @param keywords 关键字
 */
export async function search(keywords: string) {
    const [, result] = await fetch('search', { keywords });
    return result;
}

/**
 * 搜索表情包
 * @param keywords 关键字
 */
export async function searchExpression(keywords: string) {
    const [, result] = await fetch('searchExpression', { keywords });
    return result;
}

/**
 * 发送消息
 * @param to 目标
 * @param type 消息类型
 * @param content 消息内容
 */
export async function sendMessage(to: string, type: string, content: string) {
    return fetch('sendMessage', { to, type, content });
}

/**
 * 发送Bot消息
 * @param to 目标
 * @param type 消息类型
 * @param content 消息内容
 */
export async function sendBotMessage(
    to: string,
    type: string,
    content: string,
) {
    return fetch('sendBotMessage', { to, type, content });
}

/**
 * 发送群组 Bot 消息（群聊 AI 回复）
 * @param to 群组 id
 * @param type 消息类型
 * @param content 消息内容
 */
export async function sendGroupBotMessage(
    to: string,
    type: string,
    content: string,
) {
    return fetch('sendGroupBotMessage', { to, type, content });
}

/**
 * 删除消息
 * @param messageId 要删除的消息id
 */
export async function deleteMessage(messageId: string) {
    const [err] = await fetch('deleteMessage', { messageId });
    return !err;
}

/**
 * 获取目标群组的在线用户列表
 * @param groupId 目标群id
 */
export const getGroupOnlineMembers = (() => {
    let cache: {
        groupId: string;
        key: string;
        members: GroupMember[];
    } = {
        groupId: '',
        key: '',
        members: [],
    };
    return async function _getGroupOnlineMembers(
        groupId: string,
    ): Promise<GroupMember[]> {
        const [, result] = await fetch('getGroupOnlineMembersV2', {
            groupId,
            cache: cache.groupId === groupId ? cache.key : undefined,
        });
        if (!result) {
            return [];
        }

        if (result.cache === cache.key) {
            return cache.members as GroupMember[];
        }
        cache = {
            groupId,
            key: result.cache,
            members: result.members,
        };
        return result.members;
    };
})();

/**
 * 获取默认群组的在线用户列表
 */
export async function getDefaultGroupOnlineMembers() {
    const [, members] = await fetch('getDefaultGroupOnlineMembers');
    return members;
}

/**
 * 获取默认群组的所有成员（含在线状态、群主、最后登录时间）
 * 无需登录态
 */
export async function getDefaultGroupAllMembers(): Promise<GroupAllMemberItem[]> {
    const [, result] = await fetch('getDefaultGroupAllMembers');
    if (!result || !result.members) {
        return [];
    }
    return result.members;
}

/** 群内成员（含在线状态、群主、最后登录时间） */
export interface GroupAllMemberItem {
    user: {
        _id: string;
        username: string;
        avatar: string;
        createTime: string | null;
        lastLoginTime: string | null;
        tag?: string;
    };
    isCreator: boolean;
    isOnline: boolean;
}

/**
 * 获取群内所有成员
 */
export async function getGroupAllMembers(
    groupId: string,
): Promise<GroupAllMemberItem[]> {
    const [, result] = await fetch('getGroupAllMembers', { groupId });
    return result?.members ?? [];
}

/**
 * 封禁用户
 * @param email 目标邮箱
 */
export async function sealUser(email: string) {
    const [err] = await fetch('sealUser', { email });
    return !err;
}

export async function unsealUser(email: string) {
    const [err] = await fetch('unsealUser', { email });
    return !err;
}

/**
 * 获取封禁用户列表
 */
export async function getSealList() {
    const [, sealList] = await fetch('getSealList');
    return sealList;
}

export async function getSystemConfig() {
    const [, systemConfig] = await fetch('getSystemConfig');
    return systemConfig;
}

/**
 * 获取公开系统配置（供聊天区使用）
 */
export async function getPublicSystemConfig() {
    const [, config] = await fetch('getPublicSystemConfig');
    return config;
}

/**
 * 设置系统配置项（管理员）
 */
export async function setSystemConfig(key: string, value: string) {
    const [, result] = await fetch('setSystemConfig', { key, value });
    return !!result;
}

export async function getUserOnlineStatus(userId: string): Promise<{ isOnline: boolean; lastLoginTime?: string | null } | null> {
    const [, res] = await fetch('getUserOnlineStatus', { userId });
    return res ? { isOnline: res.isOnline, lastLoginTime: res.lastLoginTime } : null;
}

export async function updateHistory(linkmanId: string, messageId: string) {
    const [, result] = await fetch('updateHistory', { linkmanId, messageId });
    return !!result;
}

/**
 * 管理员按邮箱查找用户（用于删除/封禁前校验）
 * @param email 目标邮箱
 */
export async function getAdminUserByEmail(
    email: string,
): Promise<{ exists: boolean; username?: string; email?: string; _id?: string } | null> {
    const [err, res] = await fetch('getAdminUserByEmail', {
        email: email.trim(),
    });
    if (err) return null;
    return res;
}

export async function searchAdminUsers(
    keywords: string,
): Promise<{ users: { _id: string; username: string; email: string }[] } | null> {
    const [err, res] = await fetch('searchAdminUsers', {
        keywords: keywords.trim(),
    });
    if (err) return null;
    return res;
}

/**
 * 管理员查看用户资料
 * @param userId 用户ID
 */
export async function getAdminUserInfo(
    userId: string,
): Promise<{ email: string; isOnline: boolean; lastLoginTime?: string | null } | null> {
    const [err, res] = await fetch('getAdminUserInfo', { userId });
    if (err) return null;
    return res;
}

/**
 * 删除用户
 * @param email 目标邮箱
 */
export async function deleteUser(email: string) {
    const [err] = await fetch('deleteUser', { email });
    return !err;
}
