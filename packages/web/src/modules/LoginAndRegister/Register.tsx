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
            if (user) {
                action.setUser(user);
                action.toggleLoginRegisterDialog(false);
                window.localStorage.setItem('token', user.token);

                const linkmanIds = [
                    ...user.groups.map((group: any) => group._id),
                    ...user.friends.map((friend: any) =>
                        getFriendId(friend.from, friend.to._id),
                    ),
                ];
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
                if (linkmanIds.length > 0) {
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
                    action.addLinkmanMessage(linkmanIds[0], welcomeMessage);
                }

                // 提示用户点击左上角头像修改信息
                setTimeout(() => {
                    Message.success('注册成功！点击左上角头像可以修改个人信息', 4);
                }, 500);
            } else {
                Message.error('注册失败，请重试');
            }
        } catch (error) {
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
