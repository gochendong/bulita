import { Schema, model, Document } from 'mongoose';
import { NAME_REGEXP } from '@bulita/utils/const';

const UserSchema = new Schema({
    id: {
        type: Number,
        index: true,
    },
    createTime: { type: Date, default: Date.now },
    lastLoginTime: { type: Date, default: Date.now },

    username: {
        type: String,
        trim: true,
        unique: true,
        match: NAME_REGEXP,
        index: true,
    },
    email: {
        type: String,
    },
    googleId: {
        type: String,
        index: true,
        unique: true,
        sparse: true,
    },
    level: Number,
    signature: String,
    pushToken: String,
    aiApiKey: String,
    aiBaseUrl: String,
    aiModel: String,
    aiContextCount: Number,
    rejectPrivateChat: {
        type: Boolean,
        default: false,
    },
    rejectGroupInvite: {
        type: Boolean,
        default: false,
    },
    mutedGroupIds: [
        {
            type: Schema.Types.ObjectId,
            ref: 'Group',
        },
    ],
    avatar: String,
    tag: {
        type: String,
        default: '',
        trim: true,
        match: NAME_REGEXP,
    },
    expressions: [
        {
            type: String,
        },
    ],
    lastLoginIp: String,
});

export interface UserDocument extends Document {
    /** 用户id */
    id: Number;
    /** 用户名 */
    username: string;
    /** 邮箱 */
    email: string;
    /** Google 用户唯一标识 */
    googleId: string;
    /** 等级 */
    level: Number;
    /** 签名 */
    signature: string;
    /** 推送token */
    pushToken: string;
    /** AI API Key */
    aiApiKey: string;
    /** AI Base URL */
    aiBaseUrl: string;
    /** AI Model */
    aiModel: string;
    /** AI Context Count */
    aiContextCount?: number | null;
    /** 拒绝私聊 */
    rejectPrivateChat?: boolean;
    /** 拒绝被拉入群聊 */
    rejectGroupInvite?: boolean;
    /** 免打扰群组 ID 列表 */
    mutedGroupIds?: string[];
    /** 头像 */
    avatar: string;
    /** 用户标签 */
    tag: string;
    /** 表情收藏 */
    expressions: string[];
    /** 创建时间 */
    createTime: Date;
    /** 最后登录时间 */
    lastLoginTime: Date;
    /** 最后登录IP */
    lastLoginIp: string;
}

/**
 * User Model
 * 用户信息
 */
const User = model<UserDocument>('User', UserSchema);

export default User;
