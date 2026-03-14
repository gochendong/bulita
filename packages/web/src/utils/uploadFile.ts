import * as OSS from 'ali-oss';
import fetch from './fetch';
import aiAvatarImg from '@bulita/assets/images/avatar/ai.png';

/**
 * 解析头像地址：仅保留 ai.png 本地头像，其余走站点资源或 OSS/CDN
 */
export function getAvatarUrl(url = '', process = '') {
    if (!url || typeof url !== 'string') return '';
    if (/^(blob|data):/.test(url)) return url;
    const local = getLocalAvatarUrl(url);
    if (local) return local;
    return getOSSFileUrl(url, process);
}

/**
 * 本地头像文件名仅支持 ai.png，无则返回空
 */
export function getLocalAvatarUrl(filename: string): string {
    const name = filename.split('?')[0].replace(/^.*\//, '');
    if (!name) return '';
    if (name === 'ai.png') {
        return aiAvatarImg;
    }
    return '';
}

let ossClient: OSS;
let endpoint = '/';
export async function initOSS() {
    const [, token] = await fetch('getSTS');
    if (token?.enable) {
        // @ts-ignore
        ossClient = new OSS({
            region: token.region,
            accessKeyId: token.AccessKeyId,
            accessKeySecret: token.AccessKeySecret,
            stsToken: token.SecurityToken,
            bucket: token.bucket,
        });
        if (token.endpoint) {
            endpoint = `//${token.endpoint}/`;
        }

        const OneHour = 1000 * 60 * 60;
        setInterval(async () => {
            const [, refreshToken] = await fetch('getSTS');
            if (refreshToken?.enable) {
                // @ts-ignore
                ossClient = new OSS({
                    region: refreshToken.region,
                    accessKeyId: refreshToken.AccessKeyId,
                    accessKeySecret: refreshToken.AccessKeySecret,
                    stsToken: refreshToken.SecurityToken,
                    bucket: refreshToken.bucket,
                });
            }
        }, OneHour);
    }
}

export function getOSSFileUrl(url = '', process = '') {
    const [rawUrl = '', extraPrams = ''] = url.split('?');
    if (ossClient && rawUrl.startsWith('oss:')) {
        const filename = rawUrl.slice(4);
        // expire 5min
        return `${ossClient.signatureUrl(filename, { expires: 300, process })}${
            extraPrams ? `&${extraPrams}` : ''
        }`;
    }
    if (/\/\/cdn\.suisuijiang\.com/.test(rawUrl)) {
        return `${rawUrl}?x-oss-process=${process}${
            extraPrams ? `&${extraPrams}` : ''
        }`;
    }
    return `${url}`;
}

/**
 * 上传文件
 * @param blob 文件blob数据
 * @param fileName 文件名
 * @param onProgress 上传进度回调 0-100，OSS 支持实时进度，服务端上传仅在完成时回调 100
 */
export default async function uploadFile(
    blob: Blob,
    fileName: string,
    onProgress?: (percent: number) => void,
): Promise<string> {
    // 阿里云 OSS 不可用, 上传文件到服务端
    if (!ossClient) {
        onProgress?.(0);
        const [uploadErr, result] = await fetch('uploadFile', {
            file: blob,
            fileName,
        });
        if (uploadErr) {
            throw Error(uploadErr);
        }
        onProgress?.(100);
        return result.url;
    }

    // 上传到阿里OSS，支持进度回调
    return new Promise((resolve, reject) => {
        ossClient
            .put(fileName, blob, {
                progress: (value: number) => {
                    onProgress?.(Math.round(value * 100));
                },
            })
            .then((result: { res: { status: number }; name: string }) => {
                if (result.res.status === 200) {
                    onProgress?.(100);
                    resolve(endpoint + result.name);
                } else {
                    reject(new Error('上传文件失败'));
                }
            })
            .catch(reject);
    });
}
