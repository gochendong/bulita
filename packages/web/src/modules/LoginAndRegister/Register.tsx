import React, { useState } from 'react';
import platform from 'platform';
import { useDispatch } from 'react-redux';

import getFriendId from '@bulita/utils/getFriendId';
import convertMessage from '@bulita/utils/convertMessage';
import Style from './LoginRegister.less';
import Input from '../../components/Input';
import useAction from '../../hooks/useAction';
import { register, getLinkmansLastMessagesV2 } from '../../service';
// import { Message } from '../../state/reducer';
import Message from '../../components/Message';
import { ActionTypes } from '../../state/action';

/** 登录框 */
function Register() {
    const action = useAction();
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);

    async function handleRegister() {
        if (loading) return;
        
        setLoading(true);
        try {
            const user = await register(
                '',
                '',
                platform.os?.family,
                platform.name,
                platform.description,
            );
            // 检查 user 是否是有效的用户对象（有 token 和 _id）
            if (user && user.token && user._id) {
                try {
                    action.setUser(user);
                    action.toggleLoginRegisterDialog(false);
                    window.localStorage.setItem('token', user.token);

                    const linkmanIds = [
                        ...(user.groups || []).map((group: any) => group._id),
                        ...(user.friends || []).map((friend: any) =>
                            getFriendId(friend.from, friend.to._id),
                        ),
                    ];
                    
                    // 获取联系人消息
                    if (linkmanIds.length > 0) {
                        try {
                            const linkmanMessages = await getLinkmansLastMessagesV2(linkmanIds);
                            
                            if (linkmanMessages) {
                                Object.values(linkmanMessages).forEach(
                                    // @ts-ignore
                                    ({ messages }: { messages: Message[] }) => {
                                        messages.forEach(convertMessage);
                                    },
                                );
                                dispatch({
                                    type: ActionTypes.SetLinkmansLastMessages,
                                    payload: linkmanMessages,
                                });
                            }
                            // 注意：欢迎消息现在由服务器端自动创建并发送，不需要前端手动添加
                        } catch (linkmanError) {
                            console.error('获取联系人消息失败:', linkmanError);
                            // 即使获取联系人消息失败，也不影响注册成功
                        }
                    }

                    // 提示用户点击左上角头像修改信息
                    setTimeout(() => {
                        Message.success('注册成功！点击左上角头像可设置个人信息', 4);
                    }, 500);
                } catch (userError) {
                    console.error('设置用户信息失败:', userError);
                    Message.error('注册成功，但初始化失败，请刷新页面');
                }
            } else {
                // user 为 null 或不是有效的用户对象
                Message.error('注册失败，请重试');
            }
        } catch (error) {
            console.error('注册错误:', error);
            Message.error('注册失败，请重试');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className={Style.loginRegister}>
            <button
                className={Style.button}
                onClick={handleRegister}
                type="button"
                disabled={loading}
            >
                {loading ? '注册中...' : '一键注册'}
            </button>
        </div>
    );
}

export default Register;
