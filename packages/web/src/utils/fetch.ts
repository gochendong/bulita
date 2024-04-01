import Message from '../components/Message';
import socket from '../socket';

import { SEAL_TEXT, SEAL_TIMEOUT } from '../../../utils/const';

/** 用户是否被封禁 */
let isSeal = false;

export default function fetch<T = any>(
    event: string,
    data = {},
    { toast = true } = {},
): Promise<[string | null, T | null]> {
    if (isSeal) {
        Message.error(SEAL_TEXT);
        return Promise.resolve([SEAL_TEXT, null]);
    }
    return new Promise((resolve) => {
        socket.emit(event, data, (res: any) => {
            if (typeof res === 'string') {
                if (toast) {
                    if (res !== '已过滤重复的消息') {
                        Message.info(res);
                    }
                }
                /**
                 * 服务端返回封禁状态后, 本地存储该状态
                 * 用户再触发接口请求时, 直接拒绝
                 */
                if (res === SEAL_TEXT) {
                    isSeal = true;
                    setTimeout(() => {
                        isSeal = false;
                    }, SEAL_TIMEOUT);
                }
                resolve([res, null]);
            } else {
                resolve([null, res]);
            }
        });
    });
}
