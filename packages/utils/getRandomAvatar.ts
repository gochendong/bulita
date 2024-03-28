const AvatarCount = 15;
const publicPath = process.env.PublicPath || '/';

/**
 * 获取随机头像
 */
export default function getRandomAvatar() {
    const number = Math.floor(Math.random() * avatars.length);
    // return `${publicPath}avatar/${number}.jpg`;
    return avatars[number];
}

/**
 * 获取默认头像
 */
export function getDefaultAvatar() {
    return `${publicPath}avatar/0.jpg`;
}

const avatars = [
    'https://bulita.net/oss/bulita/public/avatar/default/zoe.png',
    'https://bulita.net/oss/bulita/public/avatar/default/william.png',
    'https://bulita.net/oss/bulita/public/avatar/default/walter.png',
    'https://bulita.net/oss/bulita/public/avatar/default/thomas.png',
    'https://bulita.net/oss/bulita/public/avatar/default/taylor.png',
    'https://bulita.net/oss/bulita/public/avatar/default/sophia.png',
    'https://bulita.net/oss/bulita/public/avatar/default/sam.png',
    'https://bulita.net/oss/bulita/public/avatar/default/ryan.png',
    'https://bulita.net/oss/bulita/public/avatar/default/ruby.png',
    'https://bulita.net/oss/bulita/public/avatar/default/quinn.png',
    'https://bulita.net/oss/bulita/public/avatar/default/paul.png',
    'https://bulita.net/oss/bulita/public/avatar/default/owen.png',
    'https://bulita.net/oss/bulita/public/avatar/default/olivia.png',
    'https://bulita.net/oss/bulita/public/avatar/default/norman.png',
    'https://bulita.net/oss/bulita/public/avatar/default/nora.png',
    'https://bulita.net/oss/bulita/public/avatar/default/natalie.png',
    'https://bulita.net/oss/bulita/public/avatar/default/naomi.png',
    'https://bulita.net/oss/bulita/public/avatar/default/miley.png',
    'https://bulita.net/oss/bulita/public/avatar/default/mike.png',
    'https://bulita.net/oss/bulita/public/avatar/default/lucas.png',
    'https://bulita.net/oss/bulita/public/avatar/default/kylie.png',
    'https://bulita.net/oss/bulita/public/avatar/default/julia.png',
    'https://bulita.net/oss/bulita/public/avatar/default/joshua.png',
    'https://bulita.net/oss/bulita/public/avatar/default/john.png',
    'https://bulita.net/oss/bulita/public/avatar/default/jane.png',
    'https://bulita.net/oss/bulita/public/avatar/default/jackson.png',
    'https://bulita.net/oss/bulita/public/avatar/default/ivy.png',
    'https://bulita.net/oss/bulita/public/avatar/default/isaac.png',
    'https://bulita.net/oss/bulita/public/avatar/default/henry.png',
    'https://bulita.net/oss/bulita/public/avatar/default/harry.png',
    'https://bulita.net/oss/bulita/public/avatar/default/harold.png',
    'https://bulita.net/oss/bulita/public/avatar/default/hanna.png',
    'https://bulita.net/oss/bulita/public/avatar/default/grace.png',
    'https://bulita.net/oss/bulita/public/avatar/default/george.png',
    'https://bulita.net/oss/bulita/public/avatar/default/freddy.png',
    'https://bulita.net/oss/bulita/public/avatar/default/frank.png',
    'https://bulita.net/oss/bulita/public/avatar/default/finn.png',
    'https://bulita.net/oss/bulita/public/avatar/default/emma.png',
    'https://bulita.net/oss/bulita/public/avatar/default/emily.png',
    'https://bulita.net/oss/bulita/public/avatar/default/edward.png',
    'https://bulita.net/oss/bulita/public/avatar/default/clara.png',
    'https://bulita.net/oss/bulita/public/avatar/default/claire.png',
    'https://bulita.net/oss/bulita/public/avatar/default/chloe.png',
    'https://bulita.net/oss/bulita/public/avatar/default/audrey.png',
    'https://bulita.net/oss/bulita/public/avatar/default/arthur.png',
    'https://bulita.net/oss/bulita/public/avatar/default/anna.png',
    'https://bulita.net/oss/bulita/public/avatar/default/andy.png',
    'https://bulita.net/oss/bulita/public/avatar/default/alfred.png',
    'https://bulita.net/oss/bulita/public/avatar/default/alexa.png',
    'https://bulita.net/oss/bulita/public/avatar/default/abigail.png',
];
