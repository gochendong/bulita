import Message from '../components/Message';
import socket from '../socket';


export default function fetch<T = any>(
    event: string,
    data = {},
    { toast = true } = {},
): Promise<[string | null, T | null]> {
    return new Promise((resolve) => {
        let settled = false;
        const timer = window.setTimeout(() => {
            if (settled) {
                return;
            }
            settled = true;
            resolve(['请求超时', null]);
        }, 15000);

        socket.emit(event, data, (res: any) => {
            if (settled) {
                return;
            }
            settled = true;
            window.clearTimeout(timer);
            if (typeof res === 'string') {
                if (toast) {
                    Message.info(res);
                }
                resolve([res, null]);
            } else {
                resolve([null, res]);
            }
        });
    });
}
