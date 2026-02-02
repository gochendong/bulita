import React from 'react';
import { useSelector } from 'react-redux';

import Time from '@bulita/utils/time';
import { isMobile } from '@bulita/utils/ua';
import Avatar from '../../components/Avatar';
import { State } from '../../state/reducer';
import useAction from '../../hooks/useAction';

import Style from './Linkman.less';
import useAero from '../../hooks/useAero';
import { useStore } from '../../hooks/useStore';
import { updateHistory } from '../../service';

interface LinkmanProps {
    id: string;
    name: string;
    avatar: string;
    /** 消息预览 */
    preview: string;
    unread: number;
    time: Date;
    tag: string;
    /** 好友是否在线（仅好友） */
    isOnline?: boolean;
    /** 好友最后在线时间（仅好友、离线时） */
    lastLoginTime?: string | null;
}

function Linkman(props: LinkmanProps) {
    const { id, name, avatar, preview, unread, time, tag, isOnline, lastLoginTime } = props;

    const action = useAction();
    const focus = useSelector((state: State) => state.focus);
    const aero = useAero();
    const { linkmans } = useStore();

    function formatLastOnline(dateStr: string | null | undefined): string {
        if (!dateStr) return '从未登录';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffM = Math.floor(diffMs / 60000);
        const diffH = Math.floor(diffMs / 3600000);
        const diffD = Math.floor(diffMs / 86400000);
        if (diffM < 1) return '刚刚';
        if (diffM < 60) return `${diffM} 分钟前`;
        if (diffH < 24) return `${diffH} 小时前`;
        if (diffD < 30) return `${diffD} 天前`;
        return date.toLocaleDateString();
    }

    function formatTime() {
        const nowTime = new Date();
        if (Time.isToday(nowTime, time)) {
            return Time.getHourMinute(time);
        }
        if (Time.isYesterday(nowTime, time)) {
            return '昨天';
        }
        return Time.getMonthDate(time);
    }

    async function handleClick() {
        // Update next linkman read history
        const nextFocusLinkman = linkmans[id];
        if (nextFocusLinkman) {
            const messageKeys = Object.keys(nextFocusLinkman.messages);
            if (messageKeys.length > 0) {
                const lastMessageId =
                    nextFocusLinkman.messages[
                        messageKeys[messageKeys.length - 1]
                    ]._id;
                updateHistory(nextFocusLinkman._id, lastMessageId);
            }
        }

        action.setFocus(id);
        if (isMobile) {
            action.setStatus('functionBarAndLinkmanListVisible', false);
        }
    }

    return (
        <div
            className={`${Style.linkman} ${id === focus ? Style.focus : ''}`}
            onClick={handleClick}
            role="button"
            {...aero}
        >
            <Avatar src={avatar} size={48} />
            <div className={Style.container}>
                <div className={`${Style.rowContainer} ${Style.nameTimeBlock}`}>
                    <p className={Style.name}>{name}</p>
                    <p className={Style.time}>{formatTime()}</p>
                </div>
                {isOnline !== undefined && (
                    <div className={Style.onlineStatus}>
                        {isOnline ? (
                            <span className={Style.onlineText}>在线</span>
                        ) : lastLoginTime != null ? (
                            <span className={Style.offlineText}>离线 {formatLastOnline(lastLoginTime)}</span>
                        ) : null}
                    </div>
                )}
                <div
                    className={`${Style.rowContainer} ${Style.previewUnreadBlock}`}
                >
                    <p
                        className={Style.preview}
                        // eslint-disable-next-line react/no-danger
                        // dangerouslySetInnerHTML={{ __html: preview }}
                    >
                        {preview}
                    </p>
                    {/* {unread > 0 && ( */}
                    {/*    <div className={Style.unread}> */}
                    {/*        <span>{unread > 99 ? '99' : unread}</span> */}
                    {/*    </div> */}
                    {/* )} */}
                </div>
            </div>
        </div>
    );
}

export default Linkman;
