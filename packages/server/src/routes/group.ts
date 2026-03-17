import assert, { AssertionError } from 'assert';
import { Types } from '@bulita/database/mongoose';
import stringHash from 'string-hash';

import getRandomAvatar from '@bulita/utils/getRandomAvatar';
import Group, { GroupDocument } from '@bulita/database/mongoose/models/group';
import Socket from '@bulita/database/mongoose/models/socket';
import Message from '@bulita/database/mongoose/models/message';
import User from '@bulita/database/mongoose/models/user';
import { getSocketServer } from '../utils/socketServer';

const { isValid } = Types.ObjectId;

function formatGroup(group: GroupDocument) {
    return {
        _id: group._id,
        name: group.name,
        avatar: group.avatar,
        announcement: group.announcement || '',
        allowJoin: group.allowJoin !== false,
        createTime: group.createTime,
        creator: group.creator?.toString?.() || '',
        isDefault: group.isDefault,
        membersCount: group.members.length,
    };
}

function assertGroupOwner(group: GroupDocument, userId: string) {
    assert(group.creator, '群组未设置群主');
    assert(
        group.creator.toString() === userId,
        '只有群主才能执行该操作',
    );
}

function assertManageableGroup(group: GroupDocument) {
    assert(group.isDefault !== true, '默认群组仅支持转让管理员');
}

async function syncUserSocketsGroupRoom(
    userId: string,
    groupId: string,
    action: 'join' | 'leave',
) {
    const io = getSocketServer();
    const sockets = await Socket.find({ user: userId });
    sockets.forEach((socketDoc) => {
        const socket = io.sockets.sockets.get(socketDoc.id);
        if (socket) {
            if (action === 'join') {
                socket.join(groupId);
            } else {
                socket.leave(groupId);
            }
        }
    });
    return sockets.map((socketDoc) => socketDoc.id);
}

/**
 * 获取指定群组的在线用户辅助方法
 * @param group 群组
 */
async function getGroupOnlineMembersHelper(group: GroupDocument) {
    const sockets = await Socket.find(
        {
            user: {
                $in: group.members.map((member) => member.toString()),
            },
        },
        {
            os: 1,
            browser: 1,
            environment: 1,
            user: 1,
        },
    ).populate('user', { username: 1, avatar: 1 });
    const filterSockets = sockets.reduce((result, socket) => {
        result.set(socket.user._id.toString(), socket);
        return result;
    }, new Map());
    return Array.from(filterSockets.values());
}

/**
 * 创建群组
 * @param ctx Context
 */
export async function createGroup(ctx: Context<{ name: string }>) {
    const { getConfigWithDefault } = await import('../utils/runtimeConfig');
    const maxGroupNumStr = await getConfigWithDefault('MAX_GROUP_NUM');
    const maxGroupsCount = parseInt(maxGroupNumStr, 10) || 0;
    const ownGroupCount = await Group.count({ creator: ctx.socket.user });
    assert(
        ctx.socket.isAdmin || ownGroupCount < maxGroupsCount,
        `创建群组失败, 当前最多允许创建${maxGroupsCount}个群组`,
    );

    const { name } = ctx.data;
    assert(name, '群组名不能为空');

    const group = await Group.findOne({ name });
    assert(!group, '该群组已存在');

    const user = await User.findOne({ _id: ctx.socket.user });

    let newGroup = null;
    try {
        newGroup = await Group.create({
            name,
            avatar: getRandomAvatar(),
            allowJoin: true,
            creator: ctx.socket.user,
            members: [ctx.socket.user],
        } as GroupDocument);
    } catch (err) {
        if (err.name === 'ValidationError') {
            return '群组名包含不支持的字符或者长度超过限制';
        }
        throw err;
    }

    ctx.socket.join(newGroup._id.toString());
    return {
        ...formatGroup(newGroup),
    };
}

/**
 * 加入群组
 * @param ctx Context
 */
export async function joinGroup(ctx: Context<{ groupId: string }>) {
    const { groupId } = ctx.data;
    assert(isValid(groupId), '无效的群组ID');

    const group = await Group.findOne({ _id: groupId });
    if (!group) {
        throw new AssertionError({ message: '加入群组失败, 群组不存在' });
    }
    assert(group.allowJoin !== false, '当前群组不允许加入');
    assert(group.members.indexOf(ctx.socket.user) === -1, '你已经在群组中');

    group.members.push(ctx.socket.user);
    await group.save();

    const messages = await Message.find(
        { toGroup: groupId },
        {
            type: 1,
            content: 1,
            from: 1,
            createTime: 1,
        },
        { sort: { createTime: -1 }, limit: 3 },
    ).populate('from', { username: 1, avatar: 1 });
    messages.reverse();

    ctx.socket.join(group._id.toString());

    return {
        ...formatGroup(group),
        messages,
    };
}

/**
 * 退出群组
 * @param ctx Context
 */
export async function leaveGroup(ctx: Context<{ groupId: string }>) {
    const { groupId } = ctx.data;
    assert(isValid(groupId), '无效的群组ID');

    const group = await Group.findOne({ _id: groupId });
    if (!group) {
        throw new AssertionError({ message: '群组不存在' });
    }

    // 默认群组没有creator
    if (group.creator) {
        assert(
            group.creator.toString() !== ctx.socket.user.toString(),
            '群主不可以退出自己创建的群',
        );
    }

    const index = group.members.indexOf(ctx.socket.user);
    assert(index !== -1, '你不在群组中');

    group.members.splice(index, 1);
    await group.save();

    ctx.socket.leave(group._id.toString());

    return {};
}

const GroupOnlineMembersCacheExpireTime = 1000 * 60;

/**
 * 获取群组在线成员
 */
function getGroupOnlineMembersWrapperV2() {
    const cache: Record<
        string,
        {
            key?: string;
            value: any;
            expireTime: number;
        }
    > = {};
    return async function getGroupOnlineMembersV2(
        ctx: Context<{ groupId: string; cache?: string }>,
    ) {
        const { groupId, cache: cacheKey } = ctx.data;
        assert(isValid(groupId), '无效的群组ID');

        if (
            cache[groupId] &&
            cache[groupId].key === cacheKey &&
            cache[groupId].expireTime > Date.now()
        ) {
            return { cache: cacheKey };
        }

        const group = await Group.findOne({ _id: groupId });
        if (!group) {
            throw new AssertionError({ message: '群组不存在' });
        }
        const result = await getGroupOnlineMembersHelper(group);
        const resultCacheKey = stringHash(
            result.map((item) => item.user._id).join(','),
        ).toString(36);
        if (cache[groupId] && cache[groupId].key === resultCacheKey) {
            cache[groupId].expireTime =
                Date.now() + GroupOnlineMembersCacheExpireTime;
            if (resultCacheKey === cacheKey) {
                return { cache: cacheKey };
            }
        }

        cache[groupId] = {
            key: resultCacheKey,
            value: result,
            expireTime: Date.now() + GroupOnlineMembersCacheExpireTime,
        };
        return {
            cache: resultCacheKey,
            members: result,
        };
    };
}
export const getGroupOnlineMembersV2 = getGroupOnlineMembersWrapperV2();

export async function getGroupOnlineMembers(
    ctx: Context<{ groupId: string; cache?: string }>,
) {
    const result = await getGroupOnlineMembersV2(ctx);
    return result.members;
}

/**
 * 获取默认群组的在线成员
 * 无需登录态
 */
function getDefaultGroupOnlineMembersWrapper() {
    let cache: any = null;
    let expireTime = 0;
    return async function getDefaultGroupOnlineMembers() {
        if (cache && expireTime > Date.now()) {
            return cache;
        }

        const group = await Group.findOne({ isDefault: true });
        if (!group) {
            throw new AssertionError({ message: '群组不存在' });
        }
        cache = await getGroupOnlineMembersHelper(group);
        expireTime = Date.now() + GroupOnlineMembersCacheExpireTime;
        return cache;
    };
}
export const getDefaultGroupOnlineMembers =
    getDefaultGroupOnlineMembersWrapper();

/**
 * 获取默认群组的所有成员（含在线状态、群主、最后登录时间）
 * 无需登录态
 */
function getDefaultGroupAllMembersWrapper() {
    let cache: any = null;
    let expireTime = 0;
    return async function getDefaultGroupAllMembers() {
        if (cache && expireTime > Date.now()) {
            return cache;
        }

        const group = await Group.findOne({ isDefault: true });
        if (!group) {
            throw new AssertionError({ message: '群组不存在' });
        }

        const users = await User.find(
            { _id: { $in: group.members } },
            { username: 1, avatar: 1, createTime: 1, lastLoginTime: 1 },
        );
        const userMap = new Map(
            users.map((u) => [u._id.toString(), u.toObject()]),
        );

        const sockets = await Socket.find(
            { user: { $in: group.members.map((m) => m.toString()) } },
            { user: 1 },
        );
        const onlineIds = new Set(sockets.map((s) => s.user.toString()));
        const creatorId = group.creator?.toString?.() || '';

        const members = group.members.map((memberId) => {
            const id = memberId.toString();
            const user = userMap.get(id);
            return {
                user: user
                    ? {
                          _id: id,
                          username: user.username,
                          avatar: user.avatar,
                          createTime: user.createTime,
                          lastLoginTime: user.lastLoginTime,
                      }
                    : { _id: id, username: '', avatar: '', createTime: null, lastLoginTime: null },
                isCreator: id === creatorId,
                isOnline: onlineIds.has(id),
            };
        });

        cache = { members };
        expireTime = Date.now() + GroupOnlineMembersCacheExpireTime;
        return cache;
    };
}
export const getDefaultGroupAllMembers =
    getDefaultGroupAllMembersWrapper();

/**
 * 修改群头像, 只有群创建者有权限
 * @param ctx Context
 */
export async function changeGroupAvatar(
    ctx: Context<{ groupId: string; avatar: string }>,
) {
    const { groupId, avatar } = ctx.data;
    assert(isValid(groupId), '无效的群组ID');
    assert(avatar, '头像地址不能为空');

    const group = await Group.findOne({ _id: groupId });
    if (!group) {
        throw new AssertionError({ message: '群组不存在' });
    }
    assert(
        group.creator.toString() === ctx.socket.user.toString(),
        '只有群主才能修改头像',
    );

    await Group.updateOne({ _id: groupId }, { avatar });
    return {};
}

/**
 * 修改群组头像, 只有群创建者有权限
 * @param ctx Context
 */
export async function changeGroupName(
    ctx: Context<{ groupId: string; name: string }>,
) {
    const { groupId, name } = ctx.data;
    assert(isValid(groupId), '无效的群组ID');
    assert(name, '群组名称不能为空');
    const reg = /^[a-zA-Z0-9\u4e00-\u9fa5]+$/;
    assert(reg.test(name), '群组名只能包含汉字字母或数字');

    const group = await Group.findOne({ _id: groupId });
    if (!group) {
        throw new AssertionError({ message: '群组不存在' });
    }
    assert(group.name !== name, '新群组名不能和之前一致');
    assert(
        group.creator.toString() === ctx.socket.user.toString(),
        '只有群主才能修改头像',
    );

    const targetGroup = await Group.findOne({ name });
    assert(!targetGroup, '该群组名已存在');

    await Group.updateOne({ _id: groupId }, { name });

    ctx.socket.emit(groupId, 'changeGroupName', { groupId, name });

    return {};
}

/**
 * 删除群组, 只有群创建者有权限
 * @param ctx Context
 */
export async function deleteGroup(ctx: Context<{ groupId: string }>) {
    const { groupId } = ctx.data;
    assert(isValid(groupId), '无效的群组ID');

    const group = await Group.findOne({ _id: groupId });
    if (!group) {
        throw new AssertionError({ message: '群组不存在' });
    }
    assert(
        group.creator.toString() === ctx.socket.user.toString(),
        '只有群主才能解散群组',
    );
    assert(group.isDefault !== true, '默认群组不允许解散');

    await Group.deleteOne({ _id: group });

    ctx.socket.emit(groupId, 'deleteGroup', { groupId });

    return {};
}

export async function getGroupBasicInfo(ctx: Context<{ groupId: string }>) {
    const { groupId } = ctx.data;
    assert(isValid(groupId), '无效的群组ID');

    const group = await Group.findOne({ _id: groupId });
    if (!group) {
        throw new AssertionError({ message: '群组不存在' });
    }

    return {
        _id: group._id,
        name: group.name,
        avatar: group.avatar,
        announcement: group.announcement || '',
        allowJoin: group.allowJoin !== false,
        members: group.members.length,
    };
}

/**
 * 获取群内所有成员（含在线状态、群主、最后登录时间）
 */
export async function getGroupAllMembers(ctx: Context<{ groupId: string }>) {
    const { groupId } = ctx.data;
    assert(isValid(groupId), '无效的群组ID');

    const group = await Group.findOne({ _id: groupId });
    if (!group) {
        throw new AssertionError({ message: '群组不存在' });
    }

    const users = await User.find(
        { _id: { $in: group.members } },
        { username: 1, avatar: 1, createTime: 1, lastLoginTime: 1, tag: 1 },
    );
    const userMap = new Map(
        users.map((u) => [u._id.toString(), u.toObject()]),
    );

    const sockets = await Socket.find(
        { user: { $in: group.members.map((m) => m.toString()) } },
        { user: 1 },
    );
    const onlineIds = new Set(sockets.map((s) => s.user.toString()));
    const creatorId = group.creator?.toString?.() || '';

    const members = group.members.map((memberId) => {
        const id = memberId.toString();
        const user = userMap.get(id);
        return {
            user: user
                ? {
                      _id: id,
                      username: user.username,
                      avatar: user.avatar,
                      createTime: user.createTime,
                      lastLoginTime: user.lastLoginTime,
                      tag: user.tag || '',
                  }
                : { _id: id, username: '', avatar: '', createTime: null, lastLoginTime: null, tag: '' },
            isCreator: id === creatorId,
            isOnline: onlineIds.has(id),
        };
    });

    return { members };
}

/**
 * 修改群公告，仅群主可修改
 */
export async function changeGroupAnnouncement(
    ctx: Context<{ groupId: string; announcement: string }>,
) {
    const { groupId, announcement } = ctx.data;
    assert(isValid(groupId), '无效的群组ID');
    const group = await Group.findOne({ _id: groupId });
    if (!group) {
        throw new AssertionError({ message: '群组不存在' });
    }
    assert(
        group.creator.toString() === ctx.socket.user.toString(),
        '只有群主才能修改群公告',
    );

    await Group.updateOne(
        { _id: groupId },
        { announcement: announcement || '' },
    );

    ctx.socket.emit(groupId, 'changeGroupAnnouncement', {
        groupId,
        announcement: announcement || '',
    });

    return {};
}

/**
 * 切换群组是否允许加入，仅群主可修改，默认群组不支持
 */
export async function changeGroupAllowJoin(
    ctx: Context<{ groupId: string; allowJoin: boolean }>,
) {
    const { groupId, allowJoin } = ctx.data;
    assert(isValid(groupId), '无效的群组ID');

    const group = await Group.findOne({ _id: groupId });
    if (!group) {
        throw new AssertionError({ message: '群组不存在' });
    }
    assertGroupOwner(group, ctx.socket.user.toString());
    assertManageableGroup(group);

    group.allowJoin = allowJoin !== false;
    await group.save();

    getSocketServer().to(groupId).emit('changeGroupAllowJoin', {
        groupId,
        allowJoin: group.allowJoin !== false,
    });
    return {};
}

/**
 * 拉人进群，仅群主可操作，默认群组不支持
 */
export async function addGroupMember(
    ctx: Context<{ groupId: string; userId: string }>,
) {
    const { groupId, userId } = ctx.data;
    assert(isValid(groupId), '无效的群组ID');
    assert(isValid(userId), '无效的用户ID');

    const [group, user] = await Promise.all([
        Group.findOne({ _id: groupId }),
        User.findOne(
            { _id: userId },
            {
                _id: 1,
                username: 1,
                avatar: 1,
                createTime: 1,
                lastLoginTime: 1,
                tag: 1,
            },
        ),
    ]);
    if (!group) {
        throw new AssertionError({ message: '群组不存在' });
    }
    if (!user) {
        throw new AssertionError({ message: '用户不存在' });
    }
    assertGroupOwner(group, ctx.socket.user.toString());
    assertManageableGroup(group);
    assert(
        group.members.every((memberId) => memberId.toString() !== userId),
        '该用户已在群组中',
    );

    group.members.push(user._id.toString());
    await group.save();

    const io = getSocketServer();
    const targetSocketIds = await syncUserSocketsGroupRoom(userId, groupId, 'join');
    io.to(groupId).emit('changeGroupMembersCount', {
        groupId,
        membersCount: group.members.length,
    });
    targetSocketIds.forEach((socketId) => {
        io.to(socketId).emit('addGroup', {
            group: formatGroup(group),
        });
    });

    return {
        member: {
            user: {
                _id: user._id,
                username: user.username,
                avatar: user.avatar,
                createTime: user.createTime,
                lastLoginTime: user.lastLoginTime,
                tag: user.tag || '',
            },
            isCreator: false,
            isOnline: targetSocketIds.length > 0,
        },
        membersCount: group.members.length,
    };
}

/**
 * 踢人，仅群主可操作，默认群组不支持
 */
export async function kickGroupMember(
    ctx: Context<{ groupId: string; userId: string }>,
) {
    const { groupId, userId } = ctx.data;
    assert(isValid(groupId), '无效的群组ID');
    assert(isValid(userId), '无效的用户ID');

    const group = await Group.findOne({ _id: groupId });
    if (!group) {
        throw new AssertionError({ message: '群组不存在' });
    }
    assertGroupOwner(group, ctx.socket.user.toString());
    assertManageableGroup(group);
    assert(userId !== ctx.socket.user.toString(), '不能踢出自己');

    const memberIndex = group.members.findIndex(
        (memberId) => memberId.toString() === userId,
    );
    assert(memberIndex !== -1, '目标成员不在群组中');

    group.members.splice(memberIndex, 1);
    await group.save();

    const io = getSocketServer();
    const targetSocketIds = await syncUserSocketsGroupRoom(userId, groupId, 'leave');
    io.to(groupId).emit('changeGroupMembersCount', {
        groupId,
        membersCount: group.members.length,
    });
    targetSocketIds.forEach((socketId) => {
        io.to(socketId).emit('removeGroup', { groupId });
    });

    return {
        membersCount: group.members.length,
    };
}

/**
 * 转让群主
 */
export async function transferGroupCreator(
    ctx: Context<{ groupId: string; userId: string }>,
) {
    const { groupId, userId } = ctx.data;
    assert(isValid(groupId), '无效的群组ID');
    assert(isValid(userId), '无效的用户ID');

    const group = await Group.findOne({ _id: groupId });
    if (!group) {
        throw new AssertionError({ message: '群组不存在' });
    }
    assertGroupOwner(group, ctx.socket.user.toString());
    assert(userId !== ctx.socket.user.toString(), '无需转让给自己');
    assert(
        group.members.some((memberId) => memberId.toString() === userId),
        '目标成员不在群组中',
    );

    group.creator = userId;
    await group.save();

    getSocketServer().to(groupId).emit('changeGroupCreator', {
        groupId,
        creator: userId,
    });

    return {};
}
