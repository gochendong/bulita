import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import loadable from '@loadable/component';
import platform from 'platform';

import { isMobile } from '@bulita/utils/ua';
import { State } from '../../state/reducer';
import useIsLogin from '../../hooks/useIsLogin';
import Avatar from '../../components/Avatar';
import Tooltip from '../../components/Tooltip';
import IconButton from '../../components/IconButton';
import OnlineStatus from './OnlineStatus';
import useAction from '../../hooks/useAction';
import Message from '../../components/Message';
import { guest } from '../../service';
import convertMessage from '@bulita/utils/convertMessage';
import { ActionTypes } from '../../state/action';

import Admin from './Admin';

import Style from './Sidebar.less';
import useAero from '../../hooks/useAero';
import store from '../../state/store';

const SelfInfoAsync = loadable(
    () =>
        // @ts-ignore
        import(/* webpackChunkName: "self-info" */ './SelfInfo'),
);
const SettingAsync = loadable(
    // @ts-ignore
    () => import(/* webpackChunkName: "setting" */ './Setting'),
);

function Sidebar() {
    const sidebarVisible = useSelector(
        (state: State) => state.status.sidebarVisible,
    );
    const action = useAction();
    const isLogin = useIsLogin();
    const isConnect = useSelector((state: State) => state.connect);
    const isAdmin = useSelector(
        (state: State) => state.user && state.user.isAdmin,
    );
    const tag = useSelector((state: State) => state.user && state.user.tag);
    const avatar = useSelector(
        (state: State) => state.user && state.user.avatar,
    );

    const [selfInfoDialogVisible, toggleSelfInfoDialogVisible] =
        useState(false);
    const [adminDialogVisible, toggleAdminDialogVisible] = useState(false);
    const [downloadDialogVisible, toggleDownloadDialogVisible] =
        useState(false);
    const [rewardDialogVisible, toggleRewardDialogVisible] = useState(false);
    const [settingDialogVisible, toggleSettingDialogVisible] = useState(false);
    const aero = useAero();

    if (!sidebarVisible) {
        return null;
    }

    async function logout() {
        action.logout();
        window.localStorage.removeItem('token');
        Message.success('您已退出聊天室');

        try {
            const defaultGroup = await guest(
                platform.os?.family,
                platform.name,
                platform.description,
            );
            if (defaultGroup) {
                const { messages } = defaultGroup;
                store.dispatch({
                    type: ActionTypes.SetGuest,
                    payload: defaultGroup,
                });

                messages.forEach(convertMessage);
                store.dispatch({
                    type: ActionTypes.AddLinkmanHistoryMessages,
                    payload: {
                        linkmanId: defaultGroup._id,
                        messages,
                    },
                });
            }
        } catch (error) {
            console.error('加载默认聊天室失败:', error);
        }
    }

    function renderTooltip(text: string, component: JSX.Element) {
        const children = <div>{component}</div>;
        if (isMobile) {
            return children;
        }
        return (
            <Tooltip
                placement="right"
                mouseEnterDelay={0.3}
                overlay={<span>{text}</span>}
            >
                {children}
            </Tooltip>
        );
    }

    return (
        <>
            <div className={Style.sidebar} {...aero}>
                {isLogin && avatar && (
                    <Avatar
                        className={Style.avatar}
                        src={avatar}
                        onClick={() => toggleSelfInfoDialogVisible(true)}
                    />
                )}
                {isLogin && (
                    <OnlineStatus
                        className={Style.status}
                        status={isConnect || tag === 'bot' ? 'online' : 'offline'}
                    />
                )}
                <div className={Style.buttons}>
                    {isLogin &&
                        isAdmin &&
                        renderTooltip(
                            '管理员',
                            <div className={Style.iconWrapPurple}>
                                <IconButton
                                    width={40}
                                    height={40}
                                    icon="administrator"
                                    iconSize={28}
                                    className={Style.adminButton}
                                    onClick={() => toggleAdminDialogVisible(true)}
                                />
                            </div>,
                        )}
                    {isLogin &&
                        renderTooltip(
                            '设置',
                            <div className={Style.iconWrapTeal}>
                                <IconButton
                                    width={40}
                                    height={40}
                                    icon="setting"
                                    iconSize={26}
                                    className={Style.settingButton}
                                    onClick={() => toggleSettingDialogVisible(true)}
                                />
                            </div>,
                        )}
                    {isLogin &&
                        renderTooltip(
                            '退出登录',
                            <div className={Style.iconWrapRed}>
                                <IconButton
                                    width={40}
                                    height={40}
                                    icon="logout"
                                    iconSize={24}
                                    className={Style.logoutButton}
                                    onClick={logout}
                                />
                            </div>,
                        )}
                </div>

                {/* 弹窗 */}
                {isLogin && selfInfoDialogVisible && (
                    <SelfInfoAsync
                        visible={selfInfoDialogVisible}
                        onClose={() => toggleSelfInfoDialogVisible(false)}
                    />
                )}
                {isLogin && isAdmin && (
                    <Admin
                        visible={adminDialogVisible}
                        onClose={() => toggleAdminDialogVisible(false)}
                    />
                )}
                {isLogin && settingDialogVisible && (
                    <SettingAsync
                        visible={settingDialogVisible}
                        onClose={() => toggleSettingDialogVisible(false)}
                    />
                )}
            </div>
        </>
    );
}

export default Sidebar;
