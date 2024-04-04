import React, { useState, useRef } from 'react';
import ReactLoading from 'react-loading';
import Cropper from 'react-cropper';
import 'cropperjs/dist/cropper.css';

import { useSelector } from 'react-redux';
import config from '@bulita/config/client';
import readDiskFile from '../../utils/readDiskFile';
import uploadFile, { getOSSFileUrl } from '../../utils/uploadFile';
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
} from '../../service';
import useAction from '../../hooks/useAction';
import socket from '../../socket';

import Style from './SelfInfo.less';
import Common from './Common.less';

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
    let currentUsername = useSelector((state: State) => state.user?.username);
    let currentSignature = useSelector((state: State) => state.user?.signature);

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
                Message.success('修改头像成功');
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
        socket.disconnect();
        socket.connect();
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
            reLogin(`${username} 修改密码成功, 请使用新密码重新登录`);
        }
    }

    const [username, setUsername] = useState(currentUsername);
    const [signature, setSignature] = useState(currentSignature);

    /**
     * 修改用户名
     */
    async function handleChangeUsername() {
        const isSuccess = await changeUsername(username);
        if (isSuccess) {
            Message.success('修改用户名成功');
            onClose();
            window.location.reload();
        }
    }

    /**
     * 修改个性签名
     */
    async function handleChangeSignature() {
        const isSuccess = await changeSignature(signature);
        if (isSuccess) {
            Message.success('修改个性签名成功');
            onClose();
            window.location.reload();
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
                    {/*<p className={Common.title}>修改头像</p>*/}
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
                                    修改头像
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
                                    src={getOSSFileUrl(avatar as string)}
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
                    <p className={Common.title}>修改用户名</p>
                    <div>
                        <Input
                            className={Style.input}
                            value={username}
                            onChange={setUsername}
                            type="text"
                            placeholder={username}
                        />
                        <Button
                            className={Style.button}
                            onClick={handleChangeUsername}
                        >
                            确认修改
                        </Button>
                    </div>
                </div>
                <div className={Common.block}>
                    <p className={Common.title}>修改个性签名</p>
                    <div>
                        <Input
                            className={Style.input}
                            value={signature}
                            onChange={setSignature}
                            type="text"
                            placeholder={signature}
                        />
                        <Button
                            className={Style.button}
                            onClick={handleChangeSignature}
                        >
                            确认修改
                        </Button>
                    </div>
                </div>
                <div className={Common.block}>
                    <p className={Common.title}>修改密码</p>
                    <div>
                        <Input
                            className={Style.input}
                            value={oldPassword}
                            onChange={setOldPassword}
                            type="password"
                            placeholder="新密码"
                            showClearBtn={false}
                        />
                        <Input
                            className={Style.input}
                            value={newPassword}
                            onChange={setNewPassword}
                            type="password"
                            placeholder="重复新密码"
                            showClearBtn={false}
                        />
                        <Button
                            className={Style.button}
                            onClick={handleChangePassword}
                        >
                            确认修改
                        </Button>
                    </div>
                </div>
            </div>
        </Dialog>
    );
}

export default SelfInfo;
