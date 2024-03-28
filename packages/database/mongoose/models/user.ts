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
    salt: String,
    email: {
        type: String,
    },
    level: Number,
    signature: String,
    password: {
        type: String,
        trim: true,
        index: true,
    },
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
    /** 等级 */
    level: Number;
    /** 签名 */
    signature: string;
    /** 密码加密盐 */
    salt: string;
    /** 加密的密码 */
    password: string;
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
