import { MB } from '../utils/const';

export default {
    server:
        process.env.Server ||
        (process.env.NODE_ENV === 'development' ? '//localhost:9200' : '/'),

    maxImageSize: process.env.MaxImageSize
        ? parseInt(process.env.MaxImageSize, 10)
        : MB * 1024,
    maxBackgroundImageSize: process.env.MaxBackgroundImageSize
        ? parseInt(process.env.MaxBackgroundImageSize, 10)
        : MB * 1024,
    maxAvatarSize: process.env.MaxAvatarSize
        ? parseInt(process.env.MaxAvatarSize, 10)
        : MB * 1024,
    maxFileSize: process.env.MaxFileSize
        ? parseInt(process.env.MaxFileSize, 10)
        : MB * 1024,

    defaultTheme: 'default',
    sound: process.env.SOUND,
    tagColorMode: 'singleColor',

    // 禁止用户撤回消息, 不包括管理员, 管理员始终能撤回任何消息
    disableDeleteMessage: false,
};
