/**
 * 随机头像文件名（对应 packages/assets/images/avatar/ 下的本地图片）
 */
const avatars = [
    'abigail.png',
    'alexa.png',
    'alfred.png',
    'anna.png',
    'chloe.png',
    'finn.png',
    'grace.png',
    'isaac.png',
    'ivy.png',
    'jackson.png',
    'jane.png',
    'julia.png',
    'kylie.png',
    'miley.png',
    'naomi.png',
    'natalie.png',
    'nora.png',
    'olivia.png',
    'paul.png',
    'quinn.png',
    'sophia.png',
    'taylor.png',
    'walter.png',
    'william.png',
    'zoe.png',
];

/**
 * 获取随机头像（返回本地文件名，前端从 packages/assets/images/avatar/ 解析）
 */
export default function getRandomAvatar() {
    const index = Math.floor(Math.random() * avatars.length);
    return avatars[index];
}

/**
 * 获取默认头像文件名（AI/占位用 ai.png）
 */
export function getDefaultAvatar() {
    return 'ai.png';
}
