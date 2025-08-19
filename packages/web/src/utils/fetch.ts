import Message from '../components/Message';
import socket from '../socket';


export default function fetch<T = any>(
    event: string,
    data = {},
    { toast = true } = {},
): Promise<[string | null, T | null]> {
    return new Promise((resolve) => {
        socket.emit(event, data, (res: any) => {
            if (typeof res === 'string') {
                if (toast) {
                    if (res !== '已过滤重复的消息') {
                        Message.info(res);
                    }
                }
                resolve([res, null]);
            } else {
                resolve([null, res]);
            }
        });
    });
}
