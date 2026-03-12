import React from 'react';

import { css } from 'linaria';

const button = css`
    border: none;
    background-color: var(--primary-color-8_5);
    color: var(--primary-text-color-10);
    border-radius: 4px;
    font-size: 14px;
    transition: background-color 0.2s, color 0.2s, box-shadow 0.2s;
    user-select: none !important;

    &:hover {
        background-color: var(--primary-color-10);
    }
`;

// 更柔和的危险按钮样式，用于 type="danger"
const dangerButton = css`
    background-color: #ffe2e2;
    color: #7a1720;
    box-shadow: 0 0 0 1px rgba(220, 38, 38, 0.15);

    &:hover {
        background-color: #ffefef;
        color: #991b1b;
        box-shadow: 0 0 0 1px rgba(220, 38, 38, 0.25);
    }
`;

type Props = {
    /** 类型: primary / danger */
    type?: string;
    /** 按钮文本 */
    children: string;
    className?: string;
    /** 点击事件 */
    onClick?: () => void;
};

function Button({
    type = 'primary',
    children,
    className = '',
    onClick,
}: Props) {
    return (
        <button
            className={`${button} ${type === 'danger' ? dangerButton : ''} ${className}`}
            type="button"
            onClick={onClick}
        >
            {children}
        </button>
    );
}

export default Button;
