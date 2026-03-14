import config from '@bulita/config/client';
import themes from './themes';

/** LocalStorage存储的键值 */
export enum LocalStorageKey {
    Focus = 'focus',
    Theme = 'theme',
    PrimaryColor = 'primaryColor',
    PrimaryTextColor = 'primaryTextColor',
    BackgroundImage = 'backgroundImage',
    Aero = 'aero',
    Sound = 'sound',
    SoundSwitch = 'soundSwitch',
    NotificationSwitch = 'notificationSwitch',
    VoiceSwitch = 'voiceSwitch',
    SelfVoiceSwitch = 'selfVoiceSwitch',
    TagColorMode = 'tagColorMode',
    EnableSearchExpression = 'enableSearchExpression',
}

/**
 * 获取LocalStorage中的文本值
 * @param key 键值
 * @param defaultValue 默认值
 */
function getTextValue(key: string, defaultValue: string) {
    const value = window.localStorage.getItem(key);
    return value || defaultValue;
}

/**
 * 获取LocalStorage中的boolean值
 * @param key 键值
 * @param defaultValue 默认值
 */
function getSwitchValue(key: string, defaultValue: boolean = true) {
    const value = window.localStorage.getItem(key);
    return value ? value === 'true' : defaultValue;
}

function getSoundValue() {
    const supportedSounds = new Set([
        'default',
        'apple',
        'pcqq',
        'mobileqq',
        'huaji',
    ]);
    const defaultSound = supportedSounds.has(config.sound)
        ? config.sound
        : 'apple';
    const value = getTextValue(LocalStorageKey.Sound, defaultSound);
    return supportedSounds.has(value) ? value : defaultSound;
}

function getBackgroundImageValue(defaultValue: string) {
    const value = getTextValue(LocalStorageKey.BackgroundImage, defaultValue);
    if (!value) {
        return '';
    }
    // 兼容旧版本残留的本地背景图文件名，避免继续请求已移除资源
    if (
        value === 'background.jpg' ||
        value === '/background.jpg' ||
        value === 'images/background.jpg' ||
        value === '/images/background.jpg'
    ) {
        return '';
    }
    return value;
}

/**
 * 获取LocalStorage值
 */
export default function getData() {
    const theme = getTextValue(LocalStorageKey.Theme, config.defaultTheme);
    let themeConfig = {
        primaryColor: '',
        primaryTextColor: '',
        backgroundImage: '',
        aero: false,
    };
    // @ts-ignore
    if (theme && themes[theme]) {
        // @ts-ignore
        themeConfig = themes[theme];
    } else {
        themeConfig = {
            primaryColor: getTextValue(
                LocalStorageKey.PrimaryColor,
                themes[config.defaultTheme]?.primaryColor,
            ),
            primaryTextColor: getTextValue(
                LocalStorageKey.PrimaryTextColor,
                themes[config.defaultTheme]?.primaryTextColor,
            ),
            backgroundImage: getBackgroundImageValue(
                themes[config.defaultTheme]?.backgroundImage || '',
            ),
            aero: getSwitchValue(LocalStorageKey.Aero, false),
        };
    }
    return {
        focus: getTextValue(LocalStorageKey.Focus, ''),
        theme,
        ...themeConfig,
        sound: getSoundValue(),
        soundSwitch: getSwitchValue(LocalStorageKey.SoundSwitch),
        notificationSwitch: getSwitchValue(LocalStorageKey.NotificationSwitch),
        voiceSwitch: getSwitchValue(LocalStorageKey.VoiceSwitch),
        selfVoiceSwitch: getSwitchValue(LocalStorageKey.SelfVoiceSwitch, false),
        tagColorMode: getTextValue(
            LocalStorageKey.TagColorMode,
            config.tagColorMode,
        ),
        enableSearchExpression: getSwitchValue(
            LocalStorageKey.EnableSearchExpression,
            true,
        ),
    };
}
