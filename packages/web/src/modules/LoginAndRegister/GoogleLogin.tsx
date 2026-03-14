import React, { useEffect, useRef, useState } from 'react';
import platform from 'platform';
import { useDispatch } from 'react-redux';

import getFriendId from '@bulita/utils/getFriendId';
import convertMessage from '@bulita/utils/convertMessage';
import config from '@bulita/config/client';
import Message from '../../components/Message';
import { loginWithGoogle, getLinkmansLastMessagesV2 } from '../../service';
import { Message as MessageType } from '../../state/reducer';
import { ActionTypes } from '../../state/action';
import Style from './LoginRegister.less';

const GOOGLE_SCRIPT_ID = 'google-identity-services';
const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

function loadGoogleScript() {
    return new Promise<void>((resolve, reject) => {
        const existing = document.getElementById(
            GOOGLE_SCRIPT_ID,
        ) as HTMLScriptElement | null;
        if (existing) {
            if ((window as any).google?.accounts?.id) {
                resolve();
                return;
            }
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener(
                'error',
                () => reject(new Error('load-failed')),
                { once: true },
            );
            return;
        }

        const script = document.createElement('script');
        script.id = GOOGLE_SCRIPT_ID;
        script.src = GOOGLE_SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('load-failed'));
        document.head.appendChild(script);
    });
}

function GoogleLogin() {
    const dispatch = useDispatch();
    const buttonRef = useRef<HTMLDivElement>(null);
    const loadingRef = useRef(false);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState('');

    useEffect(() => {
        let disposed = false;

        async function initGoogleButton() {
            if (!config.googleClientId) {
                setLoadError('未配置 GOOGLE_CLIENT_ID');
                return;
            }

            try {
                await loadGoogleScript();
                if (disposed || !buttonRef.current) {
                    return;
                }

                const google = (window as any).google;
                if (!google?.accounts?.id) {
                    setLoadError('Google 登录脚本不可用');
                    return;
                }

                google.accounts.id.initialize({
                    client_id: config.googleClientId,
                    callback: async (response: { credential?: string }) => {
                        if (!response.credential || loadingRef.current) {
                            return;
                        }

                        loadingRef.current = true;
                        setLoading(true);
                        try {
                            const user = await loginWithGoogle(
                                response.credential,
                                platform.os?.family,
                                platform.name,
                                platform.description,
                            );

                            if (!user?.token) {
                                Message.error('Google 登录失败，请重试');
                                return;
                            }

                            dispatch({
                                type: ActionTypes.SetUser,
                                payload: user,
                            });
                            dispatch({
                                type: ActionTypes.SetStatus,
                                payload: {
                                    key: 'loginRegisterDialogVisible',
                                    value: false,
                                },
                            });
                            window.localStorage.setItem('token', user.token);
                            dispatch({ type: ActionTypes.Connect, payload: '' });

                            const linkmanIds = [
                                ...(user.groups || []).map((group: any) => group._id),
                                ...(user.friends || []).map((friend: any) =>
                                    getFriendId(friend.from, friend.to._id),
                                ),
                            ];

                            if (linkmanIds.length > 0) {
                                const linkmanMessages =
                                    await getLinkmansLastMessagesV2(linkmanIds);
                                Object.values(linkmanMessages).forEach(
                                    // @ts-ignore
                                    ({ messages }: { messages: MessageType[] }) => {
                                        messages.forEach(convertMessage);
                                    },
                                );
                                dispatch({
                                    type: ActionTypes.SetLinkmansLastMessages,
                                    payload: linkmanMessages,
                                });
                            }
                        } finally {
                            loadingRef.current = false;
                            setLoading(false);
                        }
                    },
                });

                buttonRef.current.innerHTML = '';
                google.accounts.id.renderButton(buttonRef.current, {
                    theme: 'outline',
                    size: 'large',
                    shape: 'pill',
                    text: 'signin_with',
                    width: 320,
                    logo_alignment: 'left',
                });
            } catch (error) {
                if (!disposed) {
                    setLoadError('Google 登录脚本加载失败');
                }
            }
        }

        initGoogleButton();

        return () => {
            disposed = true;
        };
    }, [dispatch]);

    return (
        <div className={Style.googleLogin}>
            <p className={Style.googleDescription}>
                当前仅支持 Google 账号登录
            </p>
            <div className={Style.googleButtonWrap}>
                <div ref={buttonRef} />
            </div>
            {loading && <p className={Style.googleHint}>正在验证 Google 登录...</p>}
            {loadError && <p className={Style.googleError}>{loadError}</p>}
        </div>
    );
}

export default GoogleLogin;
