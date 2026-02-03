import React from 'react';
import { useSelector } from 'react-redux';

import { Linkman, State } from '../../state/reducer';
import LinkmanComponent from './Linkman';

import Style from './LinkmanList.less';

function LinkmanList() {
    const linkmans = useSelector((state: State) => state.linkmans);

    function renderLinkman(linkman: Linkman, index: number) {
        const messages = Object.values(linkman.messages);
        const lastMessage =
            messages.length > 0 ? messages[messages.length - 1] : null;

        let time = new Date(linkman.createTime);
        let preview = '暂无消息';
        if (lastMessage) {
            time = new Date(lastMessage.createTime);
            const { type } = lastMessage;
            preview = type === 'text' ? `${lastMessage.content}` : `[${type}]`;
            if (linkman.type === 'group') {
                preview = `${lastMessage.from.username}: ${preview}`;
            }
        }
        return (
            <LinkmanComponent
                key={linkman._id}
                id={linkman._id}
                name={linkman.name}
                tag={linkman.tag}
                avatar={linkman.avatar}
                preview={preview}
                time={time}
                unread={linkman.unread}
                isOnline={linkman.type === 'friend' ? linkman.isOnline : undefined}
                lastLoginTime={linkman.type === 'friend' ? linkman.lastLoginTime : undefined}
                colorIndex={index}
            />
        );
    }

    function getLinkmanLastTime(linkman: Linkman): number {
        let time = linkman.createTime;
        const messages = Object.values(linkman.messages);
        if (messages.length > 0) {
            time = messages[messages.length - 1].createTime;
        }
        return new Date(time).getTime();
    }

    /** 好友列表只显示最近 6 个月有联系的联系人；群组全部显示 */
    const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

    function shouldShowLinkman(linkman: Linkman): boolean {
        if (linkman.type === 'group') return true;
        const lastTime = getLinkmanLastTime(linkman);
        const sixMonthsAgo = Date.now() - SIX_MONTHS_MS;
        return lastTime >= sixMonthsAgo;
    }

    function sort(linkman1: Linkman, linkman2: Linkman): number {
        return getLinkmanLastTime(linkman1) < getLinkmanLastTime(linkman2)
            ? 1
            : -1;
    }

    const filteredLinkmans = Object.values(linkmans).filter(shouldShowLinkman);

    return (
        <div className={Style.linkmanList}>
            {filteredLinkmans.sort(sort).map((linkman, index) => renderLinkman(linkman, index))}
        </div>
    );
}

export default LinkmanList;
