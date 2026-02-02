import React, { useEffect, useRef, useState } from 'react';

import { css } from 'linaria';
import Style from './Admin.less';
import Common from './Common.less';
import Dialog from '../../components/Dialog';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Message from '../../components/Message';
import store from '../../state/store';
import { ActionTypes } from '../../state/action';
import {
    getSealList,
    resetUserPassword,
    sealUser,
    setUserTag,
    sealIp,
    toggleSendMessage,
    toggleNewUserSendMessage,
    toggleGroupAI,
    getSystemConfig,
    setSystemConfig as setSystemConfigApi,
} from '../../service';

const styles = {
    button: css`
        min-width: 100px;
        height: 36px;
        margin-right: 12px;
        padding: 0 10px;
    `,
};

type SystemConfig = {
    disableSendMessage: boolean;
    disableNewUserSendMessage: boolean;
    groupAISwitch?: boolean;
    adminConfig?: Record<string, string>;
    adminConfigLabels?: Record<string, string>;
    /** 修改后需重启服务才能生效的配置键 */
    restartRequiredKeys?: string[];
};

interface AdminProps {
    visible: boolean;
    onClose: () => void;
}

function Admin(props: AdminProps) {
    const { visible, onClose } = props;

    const [tagUsername, setTagUsername] = useState('');
    const [tag, setTag] = useState('');
    const [resetPasswordUsername, setResetPasswordUsername] = useState('');
    const [sealUsername, setSealUsername] = useState('');
    const [sealList, setSealList] = useState({ users: [], ips: [] });
    const [sealIpAddress, setSealIpAddress] = useState('');
    const [systemConfig, setSystemConfig] = useState<SystemConfig>();
    const [adminConfigValues, setAdminConfigValues] = useState<Record<string, string>>({});
    const adminConfigValuesRef = useRef<Record<string, string>>({});
    adminConfigValuesRef.current = adminConfigValues;

    async function handleGetSealList() {
        const sealListRes = await getSealList();
        if (sealListRes) {
            setSealList(sealListRes);
        }
    }
    async function handleGetSystemConfig() {
        const systemConfigRes = await getSystemConfig();
        if (systemConfigRes) {
            setSystemConfig(systemConfigRes);
            if (systemConfigRes.adminConfig) {
                setAdminConfigValues(systemConfigRes.adminConfig);
            }
        }
    }
    useEffect(() => {
        if (visible) {
            handleGetSystemConfig();
            handleGetSealList();
        }
    }, [visible]);

    /**
     * 处理更新用户标签
     */
    async function handleSetTag() {
        const isSuccess = await setUserTag(tagUsername, tag.trim());
        if (isSuccess) {
            Message.success('更新用户标签成功, 请刷新页面更新数据');
            setTagUsername('');
            setTag('');
        }
    }

    /**
     * 处理重置用户密码操作
     */
    async function handleResetPassword() {
        const res = await resetUserPassword(resetPasswordUsername);
        if (res) {
            Message.success(`已将该用户的密码重置为 ${res.newPassword}`);
            setResetPasswordUsername('');
        }
    }
    /**
     * 处理封禁用户操作
     */
    async function handleSeal() {
        const isSuccess = await sealUser(sealUsername);
        if (isSuccess) {
            Message.success('封禁用户成功');
            setSealUsername('');
            handleGetSealList();
        }
    }

    async function handleSealIp() {
        const isSuccess = await sealIp(sealIpAddress);
        if (isSuccess) {
            Message.success('封禁ip成功');
            setSealIpAddress('');
            handleGetSealList();
        }
    }

    async function handleDisableSendMessage() {
        const isSuccess = await toggleSendMessage(false);
        if (isSuccess) {
            Message.success('开启禁言成功');
            handleGetSystemConfig();
        } else {
            Message.success('开启禁言失败');
            handleGetSystemConfig();
        }
    }
    async function handleEnableSendMessage() {
        const isSuccess = await toggleSendMessage(true);
        if (isSuccess) {
            Message.success('关闭禁言成功');
            handleGetSystemConfig();
        }
    }

    async function handleDisableSNewUserendMessage() {
        const isSuccess = await toggleNewUserSendMessage(false);
        if (isSuccess) {
            Message.success('开启新用户禁言成功');
            handleGetSystemConfig();
        }
    }
    async function handleEnableNewUserSendMessage() {
        const isSuccess = await toggleNewUserSendMessage(true);
        if (isSuccess) {
            Message.success('关闭新用户禁言成功');
            handleGetSystemConfig();
        }
    }

    async function handleToggleGroupAI(enable: boolean) {
        const isSuccess = await toggleGroupAI(enable);
        if (isSuccess) {
            store.dispatch({
                type: ActionTypes.SetStatus,
                payload: { key: 'groupAISwitch', value: enable },
            });
            Message.success(enable ? '已开启群聊 AI' : '已关闭群聊 AI');
            handleGetSystemConfig();
        }
    }

    async function handleSetSystemConfig(key: string, value: string) {
        const isSuccess = await setSystemConfigApi(key, value);
        if (isSuccess) {
            const needRestart = systemConfig?.restartRequiredKeys?.includes(key);
            Message.success('已保存');
            if (needRestart) {
                Message.warning('该配置需重启服务后生效');
            }
            handleGetSystemConfig();
        } else {
            Message.error('保存失败');
        }
    }

    return (
        <Dialog
            className={Style.admin}
            visible={visible}
            title="管理员控制台"
            onClose={onClose}
        >
            <div className={Common.container}>
                <div className={Common.block}>
                    {!systemConfig?.disableSendMessage ? (
                        <Button
                            className={styles.button}
                            type="danger"
                            onClick={handleDisableSendMessage}
                        >
                            开启禁言
                        </Button>
                    ) : (
                        <Button
                            className={styles.button}
                            onClick={handleEnableSendMessage}
                        >
                            关闭禁言
                        </Button>
                    )}
                    {!systemConfig?.disableNewUserSendMessage ? (
                        <Button
                            className={styles.button}
                            type="danger"
                            onClick={handleDisableSNewUserendMessage}
                        >
                            开启新用户禁言
                        </Button>
                    ) : (
                        <Button
                            className={styles.button}
                            onClick={handleEnableNewUserSendMessage}
                        >
                            关闭新用户禁言
                        </Button>
                    )}
                    {!systemConfig?.groupAISwitch ? (
                        <Button
                            className={styles.button}
                            onClick={() => handleToggleGroupAI(true)}
                        >
                            开启群聊 AI
                        </Button>
                    ) : (
                        <Button
                            className={styles.button}
                            type="danger"
                            onClick={() => handleToggleGroupAI(false)}
                        >
                            关闭群聊 AI
                        </Button>
                    )}
                </div>
                {systemConfig?.adminConfig && systemConfig?.adminConfigLabels && (
                    <div className={Common.block}>
                        <p className={Common.title}>系统配置</p>
                        <p className={Style.configTip}>以下配置存于 Redis，留空则使用代码内默认值。失焦自动保存。标注「需重启」的项修改后需重启服务生效。</p>
                        <div className={Style.configList}>
                            {Object.keys(systemConfig.adminConfig).map((key) => (
                                <div key={key} className={Style.configRow}>
                                    <label className={Style.configLabel}>
                                        {systemConfig.adminConfigLabels[key] || key}
                                        {systemConfig.restartRequiredKeys?.includes(key) ? ' (需重启)' : ''}
                                    </label>
                                    <Input
                                        className={Style.configInput}
                                        value={adminConfigValues[key] ?? ''}
                                        onChange={(v) => setAdminConfigValues((prev) => ({ ...prev, [key]: v }))}
                                        onBlur={() => handleSetSystemConfig(key, adminConfigValuesRef.current[key] ?? '')}
                                        placeholder="留空使用默认值"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                <div className={Common.block}>
                    <p className={Common.title}>重置用户密码</p>
                    <div className={Style.inputBlock}>
                        <Input
                            className={Style.input}
                            value={resetPasswordUsername}
                            onChange={setResetPasswordUsername}
                            onBlur={() => resetPasswordUsername.trim() && handleResetPassword()}
                            placeholder="要重置密码的用户名"
                        />
                    </div>
                </div>
                <div className={Common.block}>
                    <p className={Common.title}>更新用户标签</p>
                    <div className={Style.inputBlock}>
                        <Input
                            className={`${Style.input} ${Style.tagUsernameInput}`}
                            value={tagUsername}
                            onChange={setTagUsername}
                            onBlur={() => tagUsername.trim() && tag.trim() && handleSetTag()}
                            placeholder="要更新标签的用户名"
                        />
                        <Input
                            className={`${Style.input} ${Style.tagInput}`}
                            value={tag}
                            onChange={setTag}
                            onBlur={() => tagUsername.trim() && tag.trim() && handleSetTag()}
                            placeholder="标签内容"
                        />
                    </div>
                </div>
                <div className={Common.block}>
                    <p className={Common.title}>封禁用户</p>
                    <div className={Style.inputBlock}>
                        <Input
                            className={Style.input}
                            value={sealUsername}
                            onChange={setSealUsername}
                            onBlur={() => sealUsername.trim() && handleSeal()}
                            placeholder="要封禁的用户名"
                        />
                    </div>
                </div>
                <div className={Common.block}>
                    <p className={Common.title}>封禁用户列表</p>
                    <div className={Style.sealList}>
                        {sealList.users.map((username) => (
                            <span className={Style.sealUsername} key={username}>
                                {username}
                            </span>
                        ))}
                    </div>
                </div>

                <div className={Common.block}>
                    <p className={Common.title}>封禁ip</p>
                    <div className={Style.inputBlock}>
                        <Input
                            className={Style.input}
                            value={sealIpAddress}
                            onChange={setSealIpAddress}
                            onBlur={() => sealIpAddress.trim() && handleSealIp()}
                            placeholder="要封禁的ip"
                        />
                    </div>
                </div>
                <div className={Common.block}>
                    <p className={Common.title}>封禁ip列表</p>
                    <div className={Style.sealList}>
                        {sealList.ips.map((ip) => (
                            <span className={Style.sealUsername} key={ip}>
                                {ip}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </Dialog>
    );
}

export default Admin;
