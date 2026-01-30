import React from 'react';
import Style from './UserBadge.less';

/**
 * 根据注册时间计算用户铭牌等级（炫酷身份）
 */
export function getBadgeLevel(createTime: string | null | undefined): {
    label: string;
    level: number;
} {
    if (!createTime) return { label: '访客', level: 0 };
    const created = new Date(createTime).getTime();
    const now = Date.now();
    const days = Math.floor((now - created) / 86400000);
    if (days < 7) return { label: '萌新', level: 1 };
    if (days < 30) return { label: '新星', level: 2 };
    if (days < 90) return { label: '常驻', level: 3 };
    if (days < 365) return { label: '元老', level: 4 };
    return { label: '传奇', level: 5 };
}

interface UserBadgeProps {
    createTime: string | null | undefined;
    className?: string;
}

function UserBadge(props: UserBadgeProps) {
    const { createTime, className = '' } = props;
    const { label, level } = getBadgeLevel(createTime);
    if (level === 0) return null;
    return (
        <span
            className={`${Style.badge} ${Style[`level${level}`]} ${className}`}
            title={`注册 ${label}`}
        >
            {label}
        </span>
    );
}

export default UserBadge;
