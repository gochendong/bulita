/** 封禁后提示文案 */
export const SEAL_TEXT = '你已经被关进小黑屋中, 请稍后再试';

/** 封禁时间 */
export const SEAL_TIMEOUT = 1000 * 60; // 1分钟

/** 透明图 */
export const TRANSPARENT_IMAGE =
    'data:image/png;base64,R0lGODlhFAAUAIAAAP///wAAACH5BAEAAAAALAAAAAAUABQAAAIRhI+py+0Po5y02ouz3rz7rxUAOw==';

/** 加密salt位数 */
export const SALT_ROUNDS = 10;

export const MB = 1024 * 1024;

// export const NAME_REGEXP = /^([0-9a-zA-Z]{1,2}|[\u4e00-\u9eff]|[\u3040-\u309Fー]|[\u30A0-\u30FF]){1,8}$/;
export const NAME_REGEXP = /^.{1,20}$/;
