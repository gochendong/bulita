import React, { useEffect, useRef, useState } from 'react';

import Switch from 'react-switch';
import Style from './Admin.less';
import Common from './Common.less';
import Dialog from '../../components/Dialog';
import ConfirmDialog from '../../components/ConfirmDialog';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Message from '../../components/Message';
import {
    getSealList,
    searchAdminUsers,
    sealUser,
    unsealUser,
    getSystemConfig,
    setSystemConfig as setSystemConfigApi,
} from '../../service';

type SystemConfig = {
    adminConfig?: Record<string, string>;
    adminConfigLabels?: Record<string, string>;
};

interface AdminProps {
    visible: boolean;
    onClose: () => void;
}

function Admin(props: AdminProps) {
    const { visible, onClose } = props;

    const [sealKeywords, setSealKeywords] = useState('');
    const [sealSearchResult, setSealSearchResult] = useState<
        { _id: string; username: string; email: string }[]
    >([]);
    const sealKeywordsRef = useRef(sealKeywords);
    const sealSearchTimerRef = useRef<number | null>(null);
    const [sealList, setSealList] = useState({ users: [] });
    const [systemConfig, setSystemConfig] = useState<SystemConfig>();
    const [adminConfigValues, setAdminConfigValues] = useState<Record<string, string>>({});
    const adminConfigValuesRef = useRef<Record<string, string>>({});
    adminConfigValuesRef.current = adminConfigValues;
    const [confirmDialog, setConfirmDialog] = useState<{
        title: string;
        description?: string;
        confirmText?: string;
        confirmType?: string;
        onConfirm: () => Promise<void> | void;
    } | null>(null);

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
            setSealKeywords('');
            setSealSearchResult([]);
        }
    }, [visible]);

    useEffect(() => {
        sealKeywordsRef.current = sealKeywords;
    }, [sealKeywords]);

    useEffect(() => {
        if (!visible) {
            return undefined;
        }

        if (sealSearchTimerRef.current) {
            clearTimeout(sealSearchTimerRef.current);
        }

        const keywords = sealKeywords.trim();
        if (!keywords) {
            setSealSearchResult([]);
            return undefined;
        }

        sealSearchTimerRef.current = window.setTimeout(async () => {
            const result = await searchAdminUsers(keywords);
            if (sealKeywordsRef.current.trim() !== keywords) {
                return;
            }
            setSealSearchResult(result?.users || []);
        }, 1000);

        return () => {
            if (sealSearchTimerRef.current) {
                clearTimeout(sealSearchTimerRef.current);
            }
        };
    }, [sealKeywords, visible]);

    /**
     * 处理封禁用户操作
     */
    async function handleSeal(target: {
        username: string;
        email: string;
    }) {
        const email = target.email.trim();
        if (!email) {
            Message.warning('该用户没有可用邮箱');
            return;
        }
        setConfirmDialog({
            title: '确认封禁用户',
            description: `将封禁 ${target.username} <${target.email || email}>，封禁后该账号将无法继续使用聊天服务。`,
            confirmText: '确认封禁',
            onConfirm: async () => {
                const isSuccess = await sealUser(email);
                if (isSuccess) {
                    Message.success('封禁用户成功');
                    setSealKeywords('');
                    setSealSearchResult([]);
                    handleGetSealList();
                }
            },
        });
    }

    async function handleUnseal(email: string) {
        if (!email) {
            return;
        }
        setConfirmDialog({
            title: '确认解除封禁',
            description: `解除封禁后，${email} 将可以重新登录和使用聊天服务。`,
            confirmText: '确认解除',
            confirmType: 'primary',
            onConfirm: async () => {
                const isSuccess = await unsealUser(email);
                if (isSuccess) {
                    Message.success('解除封禁成功');
                    handleGetSealList();
                }
            },
        });
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

    async function handleConfirmAction() {
        const currentAction = confirmDialog?.onConfirm;
        setConfirmDialog(null);
        if (currentAction) {
            await currentAction();
        }
    }

    return (
        <>
            <Dialog
                className={Style.admin}
                visible={visible}
                title="管理员控制台"
                onClose={onClose}
            >
                <div className={Style.adminColumns}>
                    <div className={Style.adminCol}>
                        <div className={Common.container}>
                            {systemConfig?.adminConfig &&
                            systemConfig?.adminConfigLabels ? (
                                <div className={Common.block}>
                                    <p className={Common.title}>系统配置</p>
                                    <p className={Style.configTip}>
                                        以下配置优先写入 Redis。输入框留空表示该项设为空（不会使用
                                        .env）。点击输入框外即保存。
                                    </p>
                                    <div className={Style.configList}>
                                        {Object.keys(systemConfig.adminConfig).map(
                                            (key) => {
                                                const label =
                                                    systemConfig.adminConfigLabels[
                                                        key
                                                    ] || key;
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
                                                    rawValue === 'true' ||
                                                    rawValue === true;

                                                return (
                                                    <div
                                                        key={key}
                                                        className={Style.configRow}
                                                    >
                                                        <label
                                                            className={Style.configLabel}
                                                        >
                                                            {label}
                                                        </label>
                                                        {isBoolConfig ? (
                                                            <div
                                                                className={
                                                                    Style.configSwitch
                                                                }
                                                            >
                                                                <Switch
                                                                    onColor="#52d88a"
                                                                    offColor="#d4d4d8"
                                                                    uncheckedIcon={false}
                                                                    checkedIcon={false}
                                                                    onChange={(
                                                                        value: boolean,
                                                                    ) => {
                                                                        const strVal =
                                                                            value
                                                                                ? 'true'
                                                                                : 'false';
                                                                        setAdminConfigValues(
                                                                            (
                                                                                prev,
                                                                            ) => ({
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
                                                                className={
                                                                    Style.configInput
                                                                }
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
                                                                            .current[
                                                                            key
                                                                        ] ?? '',
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
                                            },
                                        )}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                    <div className={Style.adminCol}>
                        <div className={Common.container}>
                            <div className={Common.block}>
                                <p className={Common.title}>封禁用户</p>
                                <div className={Style.inputBlock}>
                                    <Input
                                        className={Style.input}
                                        value={sealKeywords}
                                        onChange={setSealKeywords}
                                        placeholder="搜索邮箱或用户名"
                                    />
                                </div>
                                {sealSearchResult.length > 0 && (
                                    <div className={Style.userSearchList}>
                                        {sealSearchResult.map((user) => (
                                            <div
                                                className={Style.userSearchItem}
                                                key={user._id}
                                            >
                                                <div className={Style.userSearchInfo}>
                                                    <span className={Style.userSearchName}>
                                                        {user.username}
                                                    </span>
                                                    <span className={Style.userSearchEmail}>
                                                        {user.email || '未绑定邮箱'}
                                                    </span>
                                                </div>
                                                <Button
                                                    className={Style.userActionButton}
                                                    type="danger"
                                                    onClick={() => handleSeal(user)}
                                                >
                                                    封禁
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className={Common.block}>
                                <p className={Common.title}>封禁用户列表</p>
                                <div className={Style.sealList}>
                                    {sealList.users.map((email) => (
                                        <div
                                            className={Style.sealUserItem}
                                            key={email}
                                        >
                                            <span className={Style.sealUsername}>
                                                {email}
                                            </span>
                                            <Button
                                                className={Style.unsealButton}
                                                onClick={() =>
                                                    handleUnseal(email)
                                                }
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
            <ConfirmDialog
                visible={!!confirmDialog}
                title={confirmDialog?.title || ''}
                description={confirmDialog?.description}
                confirmText={confirmDialog?.confirmText}
                confirmType={confirmDialog?.confirmType}
                onConfirm={handleConfirmAction}
                onClose={() => setConfirmDialog(null)}
            />
        </>
    );
}

export default Admin;
