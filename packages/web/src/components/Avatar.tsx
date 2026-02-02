import React, { SyntheticEvent, useState, useMemo } from 'react';
import { getAvatarUrl } from '../utils/uploadFile';

/** 默认/占位头像（packages/assets/images/avatar/ai.png） */
import avatarFailbackImg from '@bulita/assets/images/avatar/ai.png';
export const avatarFailback = avatarFailbackImg;

type Props = {
    /** 头像链接 */
    src: string;
    /** 展示大小 */
    size?: number;
    /** 额外类名 */
    className?: string;
    /** 点击事件 */
    onClick?: () => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
};

function Avatar({
    src,
    size = 50,
    className = '',
    onClick,
    onMouseEnter,
    onMouseLeave,
}: Props) {
    const [failTimes, updateFailTimes] = useState(0);

    /**
     * Handle avatar load fail event. Use faillback avatar instead
     * If still fail then ignore error event
     */
    function handleError(e: SyntheticEvent<HTMLImageElement>) {
        if (failTimes >= 2) {
            return;
        }
        e.currentTarget.src = avatarFailback;
        updateFailTimes(failTimes + 1);
    }

    const url = useMemo(() => {
        if (!src) return avatarFailback;
        if (/^(blob|data):/.test(src)) return src;
        return getAvatarUrl(
            src,
            `image/resize,w_${size * 2},h_${size * 2}/quality,q_90`,
        ) || avatarFailback;
    }, [src]);

    return (
        <img
            className={className}
            style={{ width: size, height: size, borderRadius: size / 2 }}
            src={url}
            alt=""
            onClick={onClick}
            onError={handleError}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        />
    );
}

export default Avatar;
