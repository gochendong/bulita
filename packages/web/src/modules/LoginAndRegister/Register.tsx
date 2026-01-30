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
import store from '../../state/store';

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
                    const firstLinkmanId = linkmanIds[0];
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
                    // 使用 requestAnimationFrame 和检查状态来确保联系人已经加载
                    const sendWelcomeMessage = () => {
                        const state = store.getState();
                        const linkman = state.linkmans[firstLinkmanId];
                        
                        if (linkman) {
                            // 联系人已加载，可以发送欢迎消息
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
                                action.addLinkmanMessage(firstLinkmanId, welcomeMessage);
                            } catch (error) {
                                console.error('发送欢迎消息失败:', error);
                            }
                        } else {
                            // 联系人还未加载，等待后重试
                            setTimeout(sendWelcomeMessage, 100);
                        }
                    };
                    
                    // 使用双重延迟确保状态更新完成
                    requestAnimationFrame(() => {
                        setTimeout(sendWelcomeMessage, 200);
                    });
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
