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
                    const linkmanMessages = await getLinkmansLastMessagesV2(linkmanIds);
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

                    // 在第一个联系人的聊天里插入系统欢迎消息
                    // 延迟发送以确保联系人已经加载到状态中，并且 SetLinkmansLastMessages 已经完成
                    setTimeout(() => {
                        const welcomeMessage = {
                            _id: `sys_welcome_${Date.now()}`,
                            type: 'system',
                            content: `欢迎 ${user.username} 加入！开始你的聊天吧～`,
                            from: {
                                _id: 'system',
                                username: '系统',
                                avatar: '',
                                originUsername: '系统',
                                tag: 'system',
                            },
                            loading: false,
                            percent: 100,
                            createTime: String(Date.now()),
                        };
                        try {
                            action.addLinkmanMessage(linkmanIds[0], welcomeMessage);
                        } catch (error) {
                            console.error('发送欢迎消息失败:', error);
                            // 如果失败，重试一次
                            setTimeout(() => {
                                try {
                                    action.addLinkmanMessage(linkmanIds[0], welcomeMessage);
                                } catch (retryError) {
                                    console.error('重试发送欢迎消息失败:', retryError);
                                }
                            }, 500);
                        }
                    }, 500);
                }

                // 提示用户点击左上角头像修改信息
                setTimeout(() => {
                    Message.success('注册成功！点击左上角头像可以修改个人信息', 4);
                }, 500);
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
