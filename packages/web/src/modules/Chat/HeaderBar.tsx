import React from 'react';
import { useSelector } from 'react-redux';
import CopyToClipboard from 'react-copy-to-clipboard';
import { css } from 'linaria';

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
    /** 功能按钮点击事件 */
    onClickFunction: () => void;
};

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
        onClickFunction,
    } = props;

    const action = useAction();
    const connectStatus = useSelector((state: State) => state.connect);
    const isLogin = useIsLogin();
    const sidebarVisible = useSelector(
        (state: State) => state.status.sidebarVisible,
    );
    const aero = useAero();

    function handleShareGroup() {
        Message.success('邀请链接复制成功');
    }

    return (
        <div className={Style.headerBar} {...aero}>
            {isMobile && (
                <div className={Style.buttonContainer}>
                    <IconButton
                        width={40}
                        height={40}
                        icon="feature"
                        iconSize={24}
                        onClick={() =>
                            action.setStatus('sidebarVisible', !sidebarVisible)
                        }
                    />
                    <IconButton
                        width={40}
                        height={40}
                        icon="friends"
                        iconSize={24}
                        onClick={() =>
                            action.setStatus(
                                'functionBarAndLinkmanListVisible',
                                true,
                            )
                        }
                    />
                </div>
            )}
            <h2 className={Style.name}>
                {name}
                {type === 'group' && totalMemberCount != null && (
                    <span className={styles.count}>{` (${totalMemberCount}人)`}</span>
                )}
                {type === 'friend' && createTime && (
                    <UserBadge createTime={createTime} />
                )}
                {tag === 'bot' && (
                    <span className={Style.tag}>
                        {/*<div className='online' />*/}
                        {'机器人'}
                    </span>
                )}
                {process.env.ADMINS.split(',').includes(name) && (
                    <span className={Style.tag}>
                        {/*<div className='online' />*/}
                        {'管理员'}
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
