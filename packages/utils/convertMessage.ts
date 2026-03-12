import WuZeiNiangImage from '@bulita/assets/images/wuzeiniang.gif';

// function convertRobot10Message(message) {
//     if (message.from._id === '5adad39555703565e7903f79') {
//         try {
//             const parseMessage = JSON.parse(message.content);
//             message.from.tag = parseMessage.source;
//             message.from.avatar = parseMessage.avatar;
//             message.from.username = parseMessage.username;
//             message.type = parseMessage.type;
//             message.content = parseMessage.content;
//         } catch (err) {
//             console.warn('解析robot10消息失败', err);
//         }
//     }
// }

function convertSystemMessage(message: any) {
    if (message.type === 'system') {
        message.from._id = 'system';
        message.from.originUsername = message.from.username;
        message.from.username = '系统';
        message.from.avatar = WuZeiNiangImage;
        message.from.tag = 'system';

        // 尝试解析 JSON，如果不是 JSON 格式则保持原内容
        try {
            const content = JSON.parse(message.content);
            // 如果解析成功且包含 command 字段，则处理命令
            if (content && typeof content === 'object' && 'command' in content) {
                switch (content.command) {
                    case 'roll': {
                        message.content = `掷出了${content.value}点 (上限${content.top}点)`;
                        break;
                    }
                    case 'rps': {
                        message.content = `使出了 ${content.value}`;
                        break;
                    }
                    default: {
                        message.content = '不支持的指令';
                    }
                }
            }
            // 如果解析成功但没有 command 字段，保持原内容不变
        } catch (error) {
            // JSON 解析失败，说明是纯文本内容，保持原内容不变
            // 例如欢迎消息等纯文本系统消息
        }
    } else if (message.deleted) {
        message.type = 'system';
        message.from._id = 'system';
        message.from.originUsername = message.from.username;
        message.from.username = '系统';
        message.from.avatar = WuZeiNiangImage;
        message.from.tag = 'system';
        message.content = `撤回了消息`;
    }
}

export default function convertMessage(message: any) {
    convertSystemMessage(message);
    return message;
}
