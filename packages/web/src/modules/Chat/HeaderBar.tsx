import React from 'react';
import { useSelector } from 'react-redux';
import CopyToClipboard from 'react-copy-to-clipboard';
import { css } from 'linaria';

import getFriendId from '@bulita/utils/getFriendId';
import { isMobile } from '@bulita/utils/ua';
import { State } from '../../state/reducer';
import useIsLogin from '../../hooks/useIsLogin';
import useAction from '../../hooks/useAction';
import IconButton from '../../components/IconButton';
import Message from '../../components/Message';
import UserBadge from '../../components/UserBadge';

import Style from './HeaderBar.less';
import useAero from '../../hooks/useAero';

const styles = {
    count: css`
        margin-left: 10px;
        font-size: 0.7em;
        opacity: 0.75;
        @media (max-width: 500px) {
            font-size: 10px;
        }
    `,
};

type Props = {
    id: string;
    /** 联系人名称, 没有联系人时会传空 */
    name: string;
    /** 联系人类型, 没有联系人时会传空 */
    type: string;
    tag: string;
    signature?: string;
    level?: number;
    /** 用户/好友注册时间，用于显示铭牌 */
    createTime?: string | null;
    onlineMembersCount?: number;
    /** 群组总人数（仅群组） */
    totalMemberCount?: number;
    isOnline?: boolean;
    /** 好友最后在线时间（仅好友、离线时） */
    lastLoginTime?: string | null;
    /** 功能按钮点击事件 */
    onClickFunction: () => void;
};

function formatLastOnline(dateStr: string | null): string {
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

function HeaderBar(props: Props) {
    const {
        id,
        name,
        type,
        signature,
        tag,
        level,
        createTime,
        onlineMembersCount,
        totalMemberCount,
        isOnline,
        lastLoginTime,
        onClickFunction,
    } = props;

    const action = useAction();
    const connectStatus = useSelector((state: State) => state.connect);
    const isLogin = useIsLogin();
    const sidebarVisible = useSelector(
        (state: State) => state.status.sidebarVisible,
    );
    const functionBarAndLinkmanListVisible = useSelector(
        (state: State) => state.status.functionBarAndLinkmanListVisible,
    );
    const aero = useAero();
    const selfId = useSelector((state: State) => state.user?._id || '');
    const isSelfLinkman =
        !!selfId && type === 'friend' && id === getFriendId(selfId, selfId);

    function handleShareGroup() {
        Message.success('邀请链接复制成功');
    }

    return (
        <div className={Style.headerBar} {...aero}>
            <div className={Style.buttonContainer}>
                {isMobile && (
                    <IconButton
                        width={40}
                        height={40}
                        icon="feature"
                        iconSize={24}
                        onClick={() =>
                            action.setStatus('sidebarVisible', !sidebarVisible)
                        }
                    />
                )}
                {isLogin && (
                    <button
                        type="button"
                        className={Style.friendsToggleButton}
                        onClick={() =>
                            action.setStatus(
                                'functionBarAndLinkmanListVisible',
                                !functionBarAndLinkmanListVisible,
                            )
                        }
                        aria-label={
                            functionBarAndLinkmanListVisible
                                ? '收起会话列表'
                                : '展开会话列表'
                        }
                        title={
                            functionBarAndLinkmanListVisible
                                ? '收起会话列表'
                                : '展开会话列表'
                        }
                    >
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            xmlns="http://www.w3.org/2000/svg"
                            className={
                                functionBarAndLinkmanListVisible
                                    ? Style.friendsToggleIconExpanded
                                    : Style.friendsToggleIconCollapsed
                            }
                        >
                            <path d="M13.5 3.5L5.5 10L13.5 16.5V3.5Z" />
                        </svg>
                    </button>
                )}
            </div>
            <h2 className={Style.name}>
                {name}
                {type === 'group' && totalMemberCount != null && (
                    <span className={styles.count}>{` (${totalMemberCount}人)`}</span>
                )}
                {type === 'friend' && createTime && tag !== 'bot' && (
                    <UserBadge createTime={createTime} />
                )}
                {isSelfLinkman && (
                    <span className={Style.selfTag}>自己</span>
                )}
                {tag === 'bot' && (
                    <span className={Style.adminTag}>机器人</span>
                )}
                {type === 'friend' &&
                    !isSelfLinkman &&
                    (tag === 'bot' || isOnline === true) && (
                    <span className={Style.onlineStatusText}>当前在线</span>
                )}
                {type === 'friend' &&
                    !isSelfLinkman &&
                    tag !== 'bot' &&
                    isOnline === false &&
                    lastLoginTime != null && (
                    <span className={Style.lastOnlineText}>
                        离线 最后在线：{formatLastOnline(lastLoginTime)}
                    </span>
                )}
                {signature ? (
                    <span className={Style.signature} title={signature}>{signature}</span>
                ) : null}
                {/*{name && (*/}
                {/*   <span>*/}
                {/*       {name}{' '}*/}
                {/*       {isLogin && onlineMembersCount !== undefined && (*/}
                {/*           <b*/}
                {/*               className={styles.count}*/}
                {/*           >{`(${onlineMembersCount})`}</b>*/}
                {/*       )}*/}
                {/*       {isLogin && isOnline !== undefined && (*/}
                {/*           <b className={styles.count}>{`(${ */}
                {/*               isOnline ? '' : '（未连接）' */}
                {/*           })`}</b>*/}
                {/*       )}*/}
                {/*   </span>*/}
                {/*)}*/}
                {isMobile && type === 'group' && (
                    <span className={Style.status}>
                        <div className={connectStatus ? 'online' : 'offline'} />
                        {connectStatus ? '在线' : '离线'}
                    </span>
                )}
            </h2>
            {isLogin && type ? (
                <div
                    className={`${Style.buttonContainer} ${Style.rightButtonContainer}`}
                >
                    {type === 'group' && (
                        <CopyToClipboard
                            text={`${window.location.origin}/invite/group/${id}`}
                        >
                            <IconButton
                                width={40}
                                height={40}
                                icon="share"
                                iconSize={24}
                                onClick={handleShareGroup}
                            />
                        </CopyToClipboard>
                    )}
                    <IconButton
                        width={40}
                        height={40}
                        icon="gongneng"
                        iconSize={24}
                        onClick={onClickFunction}
                    />
                </div>
            ) : (
                <div className={Style.buttonContainer} />
            )}
        </div>
    );
}

export default HeaderBar;
