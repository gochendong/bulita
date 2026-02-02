import React from 'react';

import Style from './IconButton.less';

type Props = {
    width: number;
    height: number;
    icon: string;
    iconSize: number;
    className?: string;
    style?: Object;
    onClick?: () => void;
    onMouseDown?: (e: React.MouseEvent) => void;
};

function IconButton({
    width,
    height,
    icon,
    iconSize,
    onClick = () => {},
    onMouseDown,
    className = '',
    style = {},
}: Props) {
    return (
        <div
            className={`${Style.iconButton} ${className}`}
            style={{ width, height, ...style }}
            onClick={onClick}
            onMouseDown={onMouseDown}
            role="button"
        >
            <i
                className={`iconfont icon-${icon}`}
                style={{ fontSize: iconSize, lineHeight: `${height}px` }}
            />
        </div>
    );
}

export default IconButton;
