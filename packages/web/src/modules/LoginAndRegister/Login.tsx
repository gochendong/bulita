import React, { useState } from 'react';
import platform from 'platform';
import { useDispatch } from 'react-redux';

import getFriendId from '@bulita/utils/getFriendId';
import convertMessage from '@bulita/utils/convertMessage';
import Input from '../../components/Input';
import useAction from '../../hooks/useAction';

import Style from './LoginRegister.less';
import { login, getLinkmansLastMessagesV2 } from '../../service';
import { Message } from '../../state/reducer';
import { ActionTypes } from '../../state/action';

/** 登录框 */
function Login() {
    const action = useAction();
    const dispatch = useDispatch();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    async function handleLogin() {
        const user = await login(
            username,
            password,
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
        }
    }

    return (
        <div className={Style.loginRegister}>
            <h3 className={Style.title}>用户名</h3>
            <Input
                className={Style.input}
                value={username}
                onChange={setUsername}
                onEnter={handleLogin}
                autoComplete="on"
                showClearBtn={false}
            />
            <h3 className={Style.title}>密码</h3>
            <Input
                className={Style.input}
                type="password"
                value={password}
                onChange={setPassword}
                onEnter={handleLogin}
                autoComplete="on"
                showClearBtn={false}
            />
            <button
                className={Style.loginButton}
                onClick={handleLogin}
                type="button"
            >
                登录
            </button>
        </div>
    );
}

export default Login;
