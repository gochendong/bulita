import React from 'react';
import { useSelector } from 'react-redux';
import Switch from 'react-switch';
import { RadioGroup, RadioButton } from 'react-radio-buttons';
import playSound from '../../utils/playSound';
import Dialog from '../../components/Dialog';
import useAction from '../../hooks/useAction';
import { State } from '../../state/reducer';

import Style from './Setting.less';
import Common from './Common.less';

interface SettingProps {
    visible: boolean;
    onClose: () => void;
}

function Setting(props: SettingProps) {
    const { visible, onClose } = props;

    const action = useAction();
    const soundSwitch = useSelector((state: State) => state.status.soundSwitch);
    const notificationSwitch = useSelector(
        (state: State) => state.status.notificationSwitch,
    );
    const sound = useSelector((state: State) => state.status.sound);
    const enableSearchExpression = useSelector(
        (state: State) => state.status.enableSearchExpression,
    );

    function handleSelectSound(newSound: string) {
        playSound(newSound);
        action.setStatus('sound', newSound);
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
            </div>
        </Dialog>
    );
}

export default Setting;
