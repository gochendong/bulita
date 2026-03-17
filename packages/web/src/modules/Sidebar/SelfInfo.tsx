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
    changeUsername,
    changeSignature,
} from '../../service';
import useAction from '../../hooks/useAction';

import Style from './SelfInfo.less';
import Common from './Common.less';
import {ActionTypes} from "../../state/action";
import store from '../../state/store';
// import useAction from "./hooks/useAction";

const { dispatch } = store;

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
    const currentEmail = useSelector((state: State) => state.user?.email);

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

    const [username, setUsername] = useState(currentUsername);
    const [signature, setSignature] = useState(currentSignature);

    useEffect(() => {
        setSignature(currentSignature);
    }, [currentSignature]);

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
            title="个人资料"
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
                    <p className={Common.title}>邮箱</p>
                    <div className={Style.readonlyField}>
                        {currentEmail || '未绑定邮箱'}
                    </div>
                </div>
            </div>
        </Dialog>
    );
}

export default SelfInfo;
