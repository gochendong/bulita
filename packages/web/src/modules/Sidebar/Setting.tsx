import React from 'react';
import { useSelector } from 'react-redux';
import Switch from 'react-switch';
import { RadioGroup, RadioButton } from 'react-radio-buttons';
import playSound from '../../utils/playSound';
import Dialog from '../../components/Dialog';
import Input from '../../components/Input';
import Message from '../../components/Message';
import useAction from '../../hooks/useAction';
import { State } from '../../state/reducer';
import { changePushToken, changeAIConfig, changePrivacySettings } from '../../service';
import store from '../../state/store';
import { ActionTypes } from '../../state/action';

import Style from './Setting.less';
import Common from './Common.less';

interface SettingProps {
    visible: boolean;
    onClose: () => void;
}

function Setting(props: SettingProps) {
    const { visible, onClose } = props;

    const action = useAction();
    const currentPushToken = useSelector((state: State) => state.user?.pushToken);
    const currentAiApiKey = useSelector((state: State) => state.user?.aiApiKey);
    const currentAiBaseUrl = useSelector((state: State) => state.user?.aiBaseUrl);
    const currentAiModel = useSelector((state: State) => state.user?.aiModel);
    const currentAiContextCount = useSelector((state: State) => state.user?.aiContextCount);
    const currentRejectPrivateChat = useSelector(
        (state: State) => state.user?.rejectPrivateChat,
    );
    const currentRejectGroupInvite = useSelector(
        (state: State) => state.user?.rejectGroupInvite,
    );
    const soundSwitch = useSelector((state: State) => state.status.soundSwitch);
    const notificationSwitch = useSelector(
        (state: State) => state.status.notificationSwitch,
    );
    const sound = useSelector((state: State) => state.status.sound);
    const enableSearchExpression = useSelector(
        (state: State) => state.status.enableSearchExpression,
    );
    const [pushToken, setPushToken] = React.useState(currentPushToken || '');
    const [pushTokenDisplay, setPushTokenDisplay] = React.useState('');
    const [aiApiKey, setAiApiKey] = React.useState(currentAiApiKey || '');
    const [aiBaseUrl, setAiBaseUrl] = React.useState(currentAiBaseUrl || '');
    const [aiModel, setAiModel] = React.useState(currentAiModel || '');
    const [aiContextCount, setAiContextCount] = React.useState(
        currentAiContextCount == null ? '' : `${currentAiContextCount}`,
    );
    const [rejectPrivateChat, setRejectPrivateChat] = React.useState(
        currentRejectPrivateChat === true,
    );
    const [rejectGroupInvite, setRejectGroupInvite] = React.useState(
        currentRejectGroupInvite === true,
    );

    function maskPushToken(token: string): string {
        if (!token) return '';
        const len = token.length;
        const side = Math.max(2, Math.min(6, Math.floor(len / 4)));
        if (len <= side * 2) return '*'.repeat(len);
        const left = token.slice(0, side);
        const right = token.slice(-side);
        const midLen = len - side * 2;
        return left + '*'.repeat(midLen) + right;
    }

    React.useEffect(() => {
        if (!visible) {
            return;
        }
        setPushToken(currentPushToken || '');
        setPushTokenDisplay(
            currentPushToken ? maskPushToken(currentPushToken) : '',
        );
        setAiApiKey(currentAiApiKey || '');
        setAiBaseUrl(currentAiBaseUrl || '');
        setAiModel(currentAiModel || '');
        setAiContextCount(
            currentAiContextCount == null ? '' : `${currentAiContextCount}`,
        );
        setRejectPrivateChat(currentRejectPrivateChat === true);
        setRejectGroupInvite(currentRejectGroupInvite === true);
    }, [
        visible,
        currentPushToken,
        currentAiApiKey,
        currentAiBaseUrl,
        currentAiModel,
        currentAiContextCount,
        currentRejectPrivateChat,
        currentRejectGroupInvite,
    ]);

    function handleSelectSound(newSound: string) {
        playSound(newSound);
        action.setStatus('sound', newSound);
    }

    async function handleChangePushToken() {
        if (pushToken === currentPushToken) return;
        const isSuccess = await changePushToken(pushToken);
        if (isSuccess) {
            store.dispatch({
                type: ActionTypes.UpdateUserInfo,
                payload: { pushToken },
            });
            Message.success('私聊通知token已更新');
        }
    }

    async function handleChangeAIConfig() {
        const normalizedApiKey = aiApiKey.trim();
        const normalizedBaseUrl = aiBaseUrl.trim();
        const normalizedModel = aiModel.trim();
        const rawContextCount = aiContextCount.trim();
        const normalizedContextCount =
            rawContextCount === '' ? null : parseInt(rawContextCount, 10);

        if (
            normalizedApiKey === (currentAiApiKey || '') &&
            normalizedBaseUrl === (currentAiBaseUrl || '') &&
            normalizedModel === (currentAiModel || '') &&
            normalizedContextCount === (currentAiContextCount ?? null)
        ) {
            return;
        }

        if (
            normalizedContextCount !== null &&
            (!Number.isFinite(normalizedContextCount) ||
                normalizedContextCount < 0 ||
                normalizedContextCount > 50)
        ) {
            Message.error('上下文数量需为 0-50 的整数');
            setAiContextCount(
                currentAiContextCount == null ? '' : `${currentAiContextCount}`,
            );
            return;
        }

        const data = await changeAIConfig(
            normalizedApiKey,
            normalizedBaseUrl,
            normalizedModel,
            normalizedContextCount === null ? '' : normalizedContextCount,
        );
        if (data) {
            store.dispatch({
                type: ActionTypes.UpdateUserInfo,
                payload: data,
            });
            setAiApiKey(data.aiApiKey || '');
            setAiBaseUrl(data.aiBaseUrl || '');
            setAiModel(data.aiModel || '');
            setAiContextCount(
                data.aiContextCount == null ? '' : `${data.aiContextCount}`,
            );
            Message.success('AI 配置已更新');
        }
    }

    async function handleSavePrivacySettings(nextSettings: {
        rejectPrivateChat: boolean;
        rejectGroupInvite: boolean;
    }) {
        const data = await changePrivacySettings(
            nextSettings.rejectPrivateChat,
            nextSettings.rejectGroupInvite,
        );
        if (!data) {
            return false;
        }
        store.dispatch({
            type: ActionTypes.UpdateUserInfo,
            payload: data,
        });
        setRejectPrivateChat(data.rejectPrivateChat === true);
        setRejectGroupInvite(data.rejectGroupInvite === true);
        Message.success('隐私设置已更新');
        return true;
    }

    return (
        <Dialog
            className={`dialog ${Style.setting}`}
            visible={visible}
            onClose={onClose}
        >
            <div className={`${Common.container} ${Style.scrollContainer}`}>
                <div className={Common.block}>
                    <p className={Common.title}>开关</p>
                    <div className={Style.switchContainer}>
                        <div className={Style.switch}>
                            <p className={Style.switchText}>声音提醒</p>
                            <Switch
                                onColor="#52d88a"
                                offColor="#d4d4d8"
                                uncheckedIcon={false}
                                checkedIcon={false}
                                onChange={(value) =>
                                    action.setStatus('soundSwitch', value)
                                }
                                checked={soundSwitch}
                            />
                        </div>
                        <div className={Style.switch}>
                            <p className={Style.switchText}>桌面提醒</p>
                            <Switch
                                onColor="#52d88a"
                                offColor="#d4d4d8"
                                uncheckedIcon={false}
                                checkedIcon={false}
                                onChange={(value) =>
                                    action.setStatus(
                                        'notificationSwitch',
                                        value,
                                    )
                                }
                                checked={notificationSwitch}
                            />
                        </div>
                        <div className={Style.switch}>
                            <p className={Style.switchText}>
                                根据输入内容推荐表情
                            </p>
                            <Switch
                                onColor="#52d88a"
                                offColor="#d4d4d8"
                                uncheckedIcon={false}
                                checkedIcon={false}
                                onChange={(value) =>
                                    action.setStatus(
                                        'enableSearchExpression',
                                        value,
                                    )
                                }
                                checked={enableSearchExpression}
                            />
                        </div>
                    </div>
                </div>
                <div className={Common.block}>
                    <p className={Common.title}>提示音</p>
                    <div>
                        <RadioGroup
                            className={Style.radioGroup}
                            value={sound}
                            onChange={handleSelectSound}
                            horizontal
                        >
                            <RadioButton value="apple">苹果</RadioButton>
                            <RadioButton value="pcqq">电脑QQ</RadioButton>
                            <RadioButton value="mobileqq">手机QQ</RadioButton>
                            <RadioButton value="huaji">滑稽</RadioButton>
                        </RadioGroup>
                    </div>
                </div>
                <div className={Common.block}>
                    <p className={Common.title}>
                        私聊通知token
                        <a
                            className={Common.href}
                            href="https://push.showdoc.com.cn/#/push"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            （去获取）
                        </a>
                    </p>
                    <Input
                        className={Style.input}
                        value={pushTokenDisplay}
                        onChange={(v) => {
                            setPushToken(v);
                            setPushTokenDisplay(v);
                        }}
                        onFocus={() => setPushTokenDisplay(pushToken)}
                        onBlur={() => {
                            setPushTokenDisplay(
                                pushToken ? maskPushToken(pushToken) : '',
                            );
                            handleChangePushToken();
                        }}
                        type="text"
                        placeholder={pushToken ? '' : '未设置'}
                    />
                </div>
                <div className={Common.block}>
                    <p className={Common.title}>个人 AI 配置</p>
                    <div className={Style.tip}>
                        设置后，所有 AI 对话优先使用你自己的 API 配置
                    </div>
                    <Input
                        className={Style.input}
                        value={aiApiKey}
                        onChange={setAiApiKey}
                        onBlur={handleChangeAIConfig}
                        type="password"
                        placeholder="API Key"
                        autoComplete="new-password"
                    />
                    <Input
                        className={Style.input}
                        value={aiBaseUrl}
                        onChange={setAiBaseUrl}
                        onBlur={handleChangeAIConfig}
                        type="text"
                        placeholder="Base URL，例如 https://your-newapi/v1"
                    />
                    <Input
                        className={Style.input}
                        value={aiModel}
                        onChange={setAiModel}
                        onBlur={handleChangeAIConfig}
                        type="text"
                        placeholder="Model，例如 gpt-4o-mini"
                    />
                    <Input
                        className={Style.input}
                        value={aiContextCount}
                        onChange={setAiContextCount}
                        onBlur={handleChangeAIConfig}
                        type="number"
                        placeholder="上下文数量，留空跟随管理员"
                    />
                </div>
                <div className={Common.block}>
                    <p className={Common.title}>隐私设置</p>
                    <div className={Style.settingRow}>
                        <div className={Style.settingInfo}>
                            <p className={Style.settingLabel}>拒绝私聊</p>
                            <p className={Style.settingDesc}>
                                开启后，其他用户不能主动和你开始私聊，自己对话不受影响
                            </p>
                        </div>
                        <Switch
                            onColor="#52d88a"
                            offColor="#d4d4d8"
                            uncheckedIcon={false}
                            checkedIcon={false}
                            checked={rejectPrivateChat}
                            onChange={async (checked) => {
                                setRejectPrivateChat(checked);
                                const success = await handleSavePrivacySettings({
                                    rejectPrivateChat: checked,
                                    rejectGroupInvite,
                                });
                                if (!success) {
                                    setRejectPrivateChat(!checked);
                                }
                            }}
                        />
                    </div>
                    <div className={Style.settingRow}>
                        <div className={Style.settingInfo}>
                            <p className={Style.settingLabel}>拒绝被拉入群聊</p>
                            <p className={Style.settingDesc}>
                                开启后，其他人不能把你拉进普通群聊，默认群不受影响
                            </p>
                        </div>
                        <Switch
                            onColor="#52d88a"
                            offColor="#d4d4d8"
                            uncheckedIcon={false}
                            checkedIcon={false}
                            checked={rejectGroupInvite}
                            onChange={async (checked) => {
                                setRejectGroupInvite(checked);
                                const success = await handleSavePrivacySettings({
                                    rejectPrivateChat,
                                    rejectGroupInvite: checked,
                                });
                                if (!success) {
                                    setRejectGroupInvite(!checked);
                                }
                            }}
                        />
                    </div>
                </div>
            </div>
        </Dialog>
    );
}

export default Setting;
