import React, { useState, useRef, useEffect } from 'react';
import ReactLoading from 'react-loading';
import Cropper from 'react-cropper';
import 'cropperjs/dist/cropper.css';

import { useSelector } from 'react-redux';
import config from '@bulita/config/client';
import readDiskFile from '../../utils/readDiskFile';
import uploadFile, { getAvatarUrl } from '../../utils/uploadFile';
import Dialog from '../../components/Dialog';
import Button from '../../components/Button';
import Input from '../../components/Input';
import { State } from '../../state/reducer';
import Message from '../../components/Message';
import {
    changeAvatar,
    changePassword,
    changeUsername,
    changeSignature,
    changePushToken
} from '../../service';
import useAction from '../../hooks/useAction';
import socket from '../../socket';

import Style from './SelfInfo.less';
import Common from './Common.less';
import {ActionTypes} from "../../state/action";
import store from '../../state/store';
// import useAction from "./hooks/useAction";

const { dispatch } = store;


const PASSWORD_REGEX = process.env.PASSWORD_REGEX || '';
const PASSWORD_TIPS = process.env.PASSWORD_TIPS || '';
const pattern = new RegExp(PASSWORD_REGEX);

interface SelfInfoProps {
    visible: boolean;
    onClose: () => void;
}

function SelfInfo(props: SelfInfoProps) {
    const { visible, onClose } = props;

    const action = useAction();
    const userId = useSelector((state: State) => state.user?._id);
    const avatar = useSelector((state: State) => state.user?.avatar);
    const currentUsername = useSelector((state: State) => state.user?.username);
    const currentSignature = useSelector((state: State) => state.user?.signature);
    const currentPushToken = useSelector((state: State) => state.user?.pushToken);

    const primaryColor = useSelector(
        (state: State) => state.status.primaryColor,
    );
    const [loading, toggleLoading] = useState(false);
    const [cropper, setCropper] = useState({
        enable: false,
        src: '',
        ext: '',
    });
    const $cropper = useRef(null);

    async function uploadAvatar(blob: Blob, ext = 'png') {
        toggleLoading(true);

        try {
            const avatarUrl = await uploadFile(
                blob,
                `Avatar/${userId}_${Date.now()}.${ext}`,
            );
            const isSuccess = await changeAvatar(avatarUrl);
            if (isSuccess) {
                action.setAvatar(URL.createObjectURL(blob));
                Message.success('头像已更新');
            }
        } catch (err) {
            console.error(err);
            Message.error('上传头像失败');
        } finally {
            toggleLoading(false);
            setCropper({ enable: false, src: '', ext: '' });
        }
    }

    async function selectAvatar() {
        const file = await readDiskFile(
            'blob',
            'image/png,image/jpeg,image/gif',
        );
        if (!file) {
            return;
        }
        if (file.length > config.maxAvatarSize) {
            // eslint-disable-next-line consistent-return
            return Message.error('选择的图片过大');
        }

        // gif头像不需要裁剪
        if (file.ext === 'gif') {
            uploadAvatar(file.result as Blob, file.ext);
        } else {
            // 显示头像裁剪
            const reader = new FileReader();
            reader.readAsDataURL(file.result as Blob);
            reader.onloadend = () => {
                setCropper({
                    enable: true,
                    src: reader.result as string,
                    ext: file.ext,
                });
            };
        }
    }

    function handleChangeAvatar() {
        // @ts-ignore
        $cropper.current.getCroppedCanvas().toBlob(async (blob: any) => {
            uploadAvatar(blob, cropper.ext);
        });
    }

    function reLogin(message: string) {
        action.logout();
        window.localStorage.removeItem('token');
        Message.success(message);
        // 不需要手动断开和重连，socket.io 会自动处理
        // socket 会在 connect 事件中自动处理登录状态
    }

    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');

    async function handleChangePassword() {
        if (oldPassword !== newPassword) {
            Message.warning('两次密码输入不一致');
            return;
        }
        if (PASSWORD_REGEX && !pattern.test(newPassword)) {
            Message.warning(PASSWORD_TIPS);
            return
        }
        const isSuccess = await changePassword(oldPassword, newPassword);
        if (isSuccess) {
            onClose();
            reLogin(`${username} 密码已更新, 请使用新密码重新登录`);
        }
    }

    const [username, setUsername] = useState(currentUsername);
    const [signature, setSignature] = useState(currentSignature);
    /**
     * 按 token 长度脱敏：两侧各显示若干字符，中间用 * 填充
     */
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

    const [pushToken, setPushToken] = useState(currentPushToken);
    const [pushTokenDisplay, setPushTokenDisplay] = useState(
        currentPushToken ? maskPushToken(currentPushToken) : ''
    );

    useEffect(() => {
        setSignature(currentSignature);
    }, [currentSignature]);

    useEffect(() => {
        if (visible) {
            setPushToken(currentPushToken);
            setPushTokenDisplay(currentPushToken ? maskPushToken(currentPushToken) : '');
        }
    }, [visible, currentPushToken]);

    useEffect(() => {
        setSignature(currentSignature);
    }, [currentSignature]);

    /**
     * 修改用户名（不能为空，留空表示不修改）
     */
    async function handleChangeUsername() {
        if (!username.trim()) {
            setUsername(currentUsername);
            return;
        }
        if (username.trim() === currentUsername) return;
        const isSuccess = await changeUsername(username.trim());
        if (isSuccess) {
            dispatch({
                type: ActionTypes.UpdateUserInfo,
                payload: {
                    username: username.trim(),
                },
            });
            Message.success('用户名已更新');
        }
    }

    /**
     * 修改个性签名
     */
    async function handleChangeSignature() {
        if (signature === currentSignature) return;
        const isSuccess = await changeSignature(signature);
        if (isSuccess) {
            dispatch({
                type: ActionTypes.UpdateUserInfo,
                payload: {
                    signature
                },
            });
            Message.success('个性签名已更新');
        }
    }

    /**
     * 修改私聊通知token
     */
    async function handleChangePushToken() {
        if (pushToken === currentPushToken) return;
        const isSuccess = await changePushToken(pushToken);
        if (isSuccess) {
            dispatch({
                type: ActionTypes.UpdateUserInfo,
                payload: {
                    pushToken
                },
            });
            Message.success('私聊通知token已更新');
        }
    }

    function handleCloseDialog(event: any) {
        /**
         * 点击关闭按钮, 或者在非图片裁剪时点击蒙层, 才能关闭弹窗
         */
        if (event.target.className === 'rc-dialog-close-x' || !cropper.enable) {
            onClose();
        }
    }

    return (
        <Dialog
            className={Style.selfInfo}
            visible={visible}
            title="个人信息设置"
            onClose={handleCloseDialog}
        >
            <div className={Common.container}>
                <div className={Common.block}>
                    {/* <p className={Common.title}>修改头像</p> */}
                    <div className={Style.changeAvatar}>
                        {cropper.enable ? (
                            <div className={Style.cropper}>
                                <Cropper
                                    className={loading ? 'blur' : ''}
                                    // @ts-ignore
                                    ref={$cropper}
                                    src={cropper.src}
                                    style={{
                                        width: 0,
                                        height: 0,
                                        paddingBottom: '50%',
                                    }}
                                    aspectRatio={1}
                                />
                                <Button
                                    className={Style.button}
                                    onClick={handleChangeAvatar}
                                >
                                    更换头像
                                </Button>
                                <ReactLoading
                                    className={`${Style.loading} ${
                                        loading ? 'show' : 'hide'
                                    }`}
                                    type="spinningBubbles"
                                    color={`rgb(${primaryColor}`}
                                    height={120}
                                    width={120}
                                />
                            </div>
                        ) : (
                            <div className={Style.preview}>
                                <img
                                    className={loading ? 'blur' : ''}
                                    alt="头像预览"
                                    src={getAvatarUrl(avatar as string)}
                                    onClick={selectAvatar}
                                />
                                <ReactLoading
                                    className={`${Style.loading} ${
                                        loading ? 'show' : 'hide'
                                    }`}
                                    type="spinningBubbles"
                                    color={`rgb(${primaryColor}`}
                                    height={80}
                                    width={80}
                                />
                            </div>
                        )}
                    </div>
                </div>
                <div className={Common.block}>
                    <p className={Common.title}>用户名</p>
                    <div>
                        <Input
                            className={Style.input}
                            value={username}
                            onChange={setUsername}
                            onBlur={handleChangeUsername}
                            type="text"
                        />
                    </div>
                </div>
                <div className={Common.block}>
                    <p className={Common.title}>个性签名</p>
                    <div>
                        <Input
                            className={Style.input}
                            value={signature}
                            onChange={setSignature}
                            onBlur={handleChangeSignature}
                            type="text"
                        />
                    </div>
                </div>
                <div className={Common.block}>
                    <p className={Common.title}>
                        设置私聊通知token
                        <a
                            className={Common.href}
                            href="https://push.showdoc.com.cn/#/push"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            （去获取）
                        </a>
                    </p>
                    <div>
                        <Input
                            className={Style.input}
                            value={pushTokenDisplay}
                            onChange={(v) => {
                                setPushToken(v);
                                setPushTokenDisplay(v);
                            }}
                            onFocus={() => setPushTokenDisplay(pushToken)}
                            onBlur={() => {
                                setPushTokenDisplay(pushToken ? maskPushToken(pushToken) : '');
                                handleChangePushToken();
                            }}
                            type="text"
                            placeholder={pushToken ? '' : '未设置'}
                        />
                    </div>
                </div>
                <div className={Common.block}>
                    <p className={Common.title}>密码</p>
                    <div>
                        <Input
                            className={Style.input}
                            value={oldPassword}
                            onChange={setOldPassword}
                            type="password"
                            placeholder="当前密码"
                            showClearBtn={false}
                            autoComplete="new-password"
                        />
                        <Input
                            className={Style.input}
                            value={newPassword}
                            onChange={setNewPassword}
                            onBlur={() => oldPassword && newPassword && handleChangePassword()}
                            type="password"
                            placeholder="新密码（填写后点击输入框外即保存）"
                            showClearBtn={false}
                        />
                    </div>
                </div>
            </div>
        </Dialog>
    );
}

export default SelfInfo;
