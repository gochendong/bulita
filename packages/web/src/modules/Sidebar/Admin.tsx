import React, { useEffect, useRef, useState } from 'react';

import { css } from 'linaria';
import Switch from 'react-switch';
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
    sealUser,
    unsealUser,
    toggleSendMessage,
    toggleGroupAI,
    getSystemConfig,
    setSystemConfig as setSystemConfigApi,
    getAdminUserByEmail,
    deleteUser,
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
    groupAISwitch?: boolean;
    adminConfig?: Record<string, string>;
    adminConfigLabels?: Record<string, string>;
};

interface AdminProps {
    visible: boolean;
    onClose: () => void;
}

function Admin(props: AdminProps) {
    const { visible, onClose } = props;

    const [sealEmail, setSealEmail] = useState('');
    const [deleteEmail, setDeleteEmail] = useState('');
    const deleteEmailRef = useRef(deleteEmail);
    deleteEmailRef.current = deleteEmail;
    const [sealList, setSealList] = useState({ users: [] });
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
     * 处理封禁用户操作
     */
    async function handleSeal() {
        const email = sealEmail.trim();
        if (!email) {
            Message.warning('请输入要封禁的邮箱');
            return;
        }
        const target = await getAdminUserByEmail(email);
        if (!target?.exists) {
            Message.warning('用户不存在');
            return;
        }
        // eslint-disable-next-line no-restricted-globals
        if (!confirm(`确定要封禁 ${target.username} <${target.email || email}> 吗？`)) {
            return;
        }
        const isSuccess = await sealUser(email);
        if (isSuccess) {
            Message.success('封禁用户成功');
            setSealEmail('');
            handleGetSealList();
        }
    }

    async function handleUnseal(email: string) {
        if (!email) {
            return;
        }
        // eslint-disable-next-line no-restricted-globals
        if (!confirm(`确定要解除封禁 ${email} 吗？`)) {
            return;
        }
        const isSuccess = await unsealUser(email);
        if (isSuccess) {
            Message.success('解除封禁成功');
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
            Message.success('已保存');
            handleGetSystemConfig();
        } else {
            Message.error('保存失败');
        }
    }

    /**
     * 失焦时按邮箱查找用户是否存在
     */
    async function handleLookupDeleteUser() {
        const email = deleteEmailRef.current.trim();
        if (!email) return;
        const res = await getAdminUserByEmail(email);
        if (res?.exists) {
            Message.success(`用户「${res.username} <${res.email || email}>」存在`);
        } else {
            Message.warning('用户不存在');
        }
    }

    async function handleDeleteUser() {
        const email = deleteEmail.trim();
        if (!email) {
            Message.warning('请输入要删除的邮箱');
            return;
        }
        const target = await getAdminUserByEmail(email);
        if (!target?.exists) {
            Message.warning('用户不存在');
            return;
        }
        // eslint-disable-next-line no-restricted-globals
        if (!confirm(`确定要删除用户 ${target.username} <${target.email || email}> 吗？此操作不可恢复！`)) {
            return;
        }
        const isSuccess = await deleteUser(email);
        if (isSuccess) {
            Message.success(`用户 ${target.email || email} 已被删除`);
            setDeleteEmail('');
        }
    }

    return (
        <Dialog
            className={Style.admin}
            visible={visible}
            title="管理员控制台"
            onClose={onClose}
        >
            <div className={Style.adminColumns}>
                <div className={Style.adminCol}>
                    <div className={Common.container}>
                        {systemConfig?.adminConfig && systemConfig?.adminConfigLabels && (
                            <div className={Common.block}>
                                <p className={Common.title}>系统配置</p>
                                <p className={Style.configTip}>以下配置优先写入 Redis。输入框留空表示该项设为空（不会使用 .env）。点击输入框外即保存。</p>
                                <div className={Style.configList}>
                                    {Object.keys(systemConfig.adminConfig).map((key) => {
                                        const label =
                                            systemConfig.adminConfigLabels[key] || key;
                                        const isBoolConfig =
                                            ['ONLY_SEARCH_DEFAULT_GROUP'].includes(
                                                key,
                                            );
                                        const isSecretConfig =
                                            key === 'OPENAI_API_KEY';
                                        const rawValue =
                                            adminConfigValues[key] ??
                                            systemConfig.adminConfig[key] ??
                                            '';
                                        const boolValue =
                                            rawValue === 'true' || rawValue === true;

                                        return (
                                            <div key={key} className={Style.configRow}>
                                                <label className={Style.configLabel}>
                                                    {label}
                                                </label>
                                                {isBoolConfig ? (
                                                    <div className={Style.configSwitch}>
                                                        <Switch
                                                            onColor="#52d88a"
                                                            offColor="#d4d4d8"
                                                            uncheckedIcon={false}
                                                            checkedIcon={false}
                                                            onChange={(value: boolean) => {
                                                                const strVal = value
                                                                    ? 'true'
                                                                    : 'false';
                                                                setAdminConfigValues(
                                                                    (prev) => ({
                                                                        ...prev,
                                                                        [key]: strVal,
                                                                    }),
                                                                );
                                                                handleSetSystemConfig(
                                                                    key,
                                                                    strVal,
                                                                );
                                                            }}
                                                            checked={boolValue}
                                                        />
                                                    </div>
                                                ) : (
                                                    <Input
                                                        className={Style.configInput}
                                                        value={String(rawValue)}
                                                        onChange={(v) =>
                                                            setAdminConfigValues(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    [key]: v,
                                                                }),
                                                            )
                                                        }
                                                        onBlur={() =>
                                                            handleSetSystemConfig(
                                                                key,
                                                                adminConfigValuesRef
                                                                    .current[key] ?? '',
                                                            )
                                                        }
                                                        type={
                                                            isSecretConfig
                                                                ? 'password'
                                                                : 'text'
                                                        }
                                                        placeholder="留空表示该项为空"
                                                        autoComplete={
                                                            isSecretConfig
                                                                ? 'new-password'
                                                                : 'off'
                                                        }
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                <div className={Common.block}>
                    <p className={Common.title}>快捷开关（全局）</p>
                    <div className={Style.buttonWrap}>
                            {!systemConfig?.disableSendMessage ? (
                                <Button
                                    className={styles.button}
                                    onClick={handleDisableSendMessage}
                                >
                                    开启全局禁言
                                </Button>
                            ) : (
                                <Button
                                    className={styles.button}
                                    onClick={handleEnableSendMessage}
                                >
                                    关闭全局禁言
                                </Button>
                            )}
                            {!systemConfig?.groupAISwitch ? (
                                <Button
                                    className={`${Style.groupAIButton}`}
                                    onClick={() => handleToggleGroupAI(true)}
                                >
                                    开启群聊 AI
                                </Button>
                            ) : (
                                <Button
                                    className={`${Style.groupAIButton} ${Style.groupAIButtonOff}`}
                                    onClick={() => handleToggleGroupAI(false)}
                                >
                                    关闭群聊 AI
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
                </div>
                <div className={Style.adminCol}>
                    <div className={Common.container}>
                        <div className={Common.block}>
                            <p className={Common.title}>删除用户</p>
                            <div className={Style.inputBlock}>
                                <Input
                                    className={Style.input}
                                    value={deleteEmail}
                                    onChange={setDeleteEmail}
                                    onBlur={() => handleLookupDeleteUser()}
                                    placeholder="要删除的邮箱"
                                />
                                <Button
                                    className={Style.button}
                                    type="danger"
                                    onClick={handleDeleteUser}
                                >
                                    确认删除
                                </Button>
                            </div>
                        </div>
                        <div className={Common.block}>
                            <p className={Common.title}>封禁用户</p>
                            <div className={Style.inputBlock}>
                                <Input
                                    className={Style.input}
                                    value={sealEmail}
                                    onChange={setSealEmail}
                                    placeholder="要封禁的邮箱"
                                />
                                <Button
                                    className={Style.button}
                                    type="danger"
                                    onClick={handleSeal}
                                >
                                    确认封禁
                                </Button>
                            </div>
                        </div>
                        <div className={Common.block}>
                            <p className={Common.title}>封禁用户列表</p>
                            <div className={Style.sealList}>
                                {sealList.users.map((email) => (
                                    <div className={Style.sealUserItem} key={email}>
                                        <span className={Style.sealUsername}>
                                            {email}
                                        </span>
                                        <Button
                                            className={Style.unsealButton}
                                            onClick={() => handleUnseal(email)}
                                        >
                                            解除封禁
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Dialog>
    );
}

export default Admin;
