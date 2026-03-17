import React, {
    useState,
    useRef,
    useEffect,
    KeyboardEvent,
} from 'react';
import { useSelector } from 'react-redux';
import loadable from '@loadable/component';

import { css } from 'linaria';
import xss from '@bulita/utils/xss';
import compressImage from '@bulita/utils/compressImage';
import config from '@bulita/config/client';
import { isMobile } from '@bulita/utils/ua';
import Switch from 'react-switch';
import fetch from '../../utils/fetch';
import voice from '../../utils/voice';
import readDiskFile, { ReadFileResult } from '../../utils/readDiskFile';
import uploadFile from '../../utils/uploadFile';
import Style from './ChatInput.less';
import useIsLogin from '../../hooks/useIsLogin';
import useAction from '../../hooks/useAction';
import Dropdown from '../../components/Dropdown';
import IconButton from '../../components/IconButton';
import Avatar, { avatarFailback } from '../../components/Avatar';
import Message from '../../components/Message';
import { Menu, MenuItem } from '../../components/Menu';
import { State } from '../../state/reducer';
import store from '../../state/store';
import {
    sendMessage,
    sendBotMessage,
    sendGroupBotMessage,
} from '../../service';
import Tooltip from '../../components/Tooltip';
import useAero from '../../hooks/useAero';
import { ensureSocketConnected } from '../../socket';

interface InputAreaProps {
    readonly busy: boolean;
    readonly minHeight: number;
    readonly maxHeight?: number;
    readonly onSubmit: (prompt: string) => void;
}

const expressionList = css`
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    height: 64px;
    position: absolute;
    left: 0;
    top: -64px;
    background-color: inherit;
    overflow-x: auto;
`;
const expressionImageContainer = css`
    flex-shrink: 0;
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.04);
`;
const expressionImage = css`
    width: 56px;
    height: 56px;
    object-fit: contain;
`;

const ExpressionAsync = loadable(
    () =>
        // @ts-ignore
        import(/* webpackChunkName: "expression" */ './Expression'),
);

let searchExpressionTimer: number = 0;

let inputIME = false;

function ChatInput(props: InputAreaProps) {
    const action = useAction();
    const isLogin = useIsLogin();
    const connect = useSelector((state: State) => state.connect);
    const selfId = useSelector((state: State) => state.user?._id);
    const username = useSelector((state: State) => state.user?.username);
    const avatar = useSelector((state: State) => state.user?.avatar);
    const email = useSelector((state: State) => state.user?.email);
    const tag = useSelector((state: State) => state.user?.tag);
    const focus = useSelector((state: State) => state.focus);
    const status = useSelector((state: State) => state.status);
    const linkman = useSelector((state: State) => state.linkmans[focus]);
    const groupAISwitch = useSelector((state: State) => state.status.groupAISwitch);
    const defaultBotName = useSelector((state: State) => state.status.defaultBotName) || '';
    const voiceSwitch = useSelector((state: State) => state.status.voiceSwitch);
    const selfVoiceSwitch = useSelector(
        (state: State) => state.status.selfVoiceSwitch,
    );
    const enableSearchExpression = useSelector(
        (state: State) => state.status.enableSearchExpression,
    );
    const quotedMessage = useSelector(
        (state: State) => state.status.quotedMessage,
    ) as
        | {
              linkmanId: string;
              messageId: string;
              username: string;
              content: string;
              type: string;
          }
        | null;
    const [expressionDialog, toggleExpressionDialog] = useState(false);
    const [addMenuOpen, setAddMenuOpen] = useState(false);
    const addTriggerRef = useRef<HTMLDivElement>(null);
    const [inputFocus, toggleInputFocus] = useState(false);
    const [inputHasContent, setInputHasContent] = useState(false);
    const [at, setAt] = useState({ enable: false, content: '' });
    const $input = useRef<HTMLInputElement>(null);
    const aero = useAero();
    const [expressions, setExpressions] = useState<
        { image: string; width: number; height: number }[]
    >([]);
    /** 待发送的图片/文件，与输入文本一起按 Enter 发送 */
    const [pendingAttachments, setPendingAttachments] = useState<
        { type: 'image' | 'file'; data: ReadFileResult; previewUrl?: string }[]
    >([]);
    const sendingLockRef = useRef(false);

    const { minHeight, maxHeight } = props;

    useEffect(() => {
        function focusInput(e: KeyboardEvent) {
            if ($input.current && $input.current.value === '' && e.key === 'Enter') {
                e.preventDefault();
                // @ts-ignore
                $input.current.focus(e);
            }
        }
        window.addEventListener('keydown', focusInput);
        return () => window.removeEventListener('keydown', focusInput);
    }, []);

    const setTextAreaHeight = (
        current: HTMLTextAreaElement | null,
        minHeight: number = 50,
        maxHeight: number = 500,
    ) => {
        if (!current) return;
        current.style.height = '0px';
        current.style.height =
            current.scrollHeight < maxHeight
                ? `${
                      current.scrollHeight > minHeight
                          ? current.scrollHeight
                          : minHeight
                }px`
                : `${maxHeight}px`;
    };

    useEffect(() => {
        setExpressions([]);
    }, [enableSearchExpression]);

    useEffect(() => {
        if (!isLogin) return;
        const pending = status.pendingRetryMessage;
        if (!pending || pending.linkmanId !== focus) return;
        const msg = store.getState().linkmans[focus]?.messages[pending.messageId];
        if (!msg) {
            action.setStatus('pendingRetryMessage', null);
            return;
        }
        action.updateMessage(focus, pending.messageId, {
            loading: true,
            sendFailed: false,
        });
        action.setStatus('pendingRetryMessage', null);
        ensureSocketConnected().then((connected) => {
            if (!connected) {
                action.updateMessage(focus, pending.messageId, {
                    loading: false,
                    sendFailed: true,
                });
                Message.error('网络未恢复，正在尝试重连，请稍后再试');
                return;
            }
            sendMessage(focus, msg.type, msg.content).then(([err, result]) => {
                if (err) {
                    action.updateMessage(focus, pending.messageId, {
                        loading: false,
                        sendFailed: true,
                    });
                } else {
                    result.loading = false;
                    result.sendFailed = false;
                    action.updateMessage(focus, pending.messageId, result);
                }
            });
        });
    }, [status.pendingRetryMessage, focus, action, isLogin]);

    if (!isLogin) {
        return <div className={Style.chatInput} />;
    }

    /**
     * 插入文本到输入框光标处
     * @param value 要插入的文本
     */
    function insertAtCursor(value: string) {
        if (!$input.current) return;
        const input = $input.current as unknown as HTMLInputElement;
        if (input.selectionStart || input.selectionStart === 0) {
            const startPos = input.selectionStart;
            const endPos = input.selectionEnd;
            const restoreTop = input.scrollTop;
            input.value =
                input.value.substring(0, startPos) +
                value +
                input.value.substring(endPos as number, input.value.length);
            if (restoreTop > 0) {
                input.scrollTop = restoreTop;
            }
            input.focus();
            input.selectionStart = startPos + value.length;
            input.selectionEnd = startPos + value.length;
        } else {
            input.value += value;
            input.focus();
        }
    }

    function handleSelectExpression(expression: string) {
        toggleExpressionDialog(false);
        insertAtCursor(`#(${expression})`);
    }

    function addBotMessage(type: string, content: string) {
        const _id = focus + Date.now();
        const message = {
            _id,
            type,
            content,
            createTime: Date.now(),
            from: {
                _id: linkman._id,
                username: linkman.name,
                avatar: linkman.avatar,
                tag: 'bot',
            },
            loading: true,
        };
        action.addLinkmanMessage(focus, message);
        return _id;
    }

    function addGroupBotMessage(type: string, content: string) {
        const _id = focus + Date.now();
        const message = {
            _id,
            type,
            content,
            createTime: Date.now(),
            from: {
                _id: defaultBotName || 'AI',
                username: defaultBotName || 'AI',
                avatar: window.localStorage.getItem('botAvatar') || '',
                tag: 'bot',
            },
            loading: true,
        };
        action.addLinkmanMessage(focus, message);
        return _id;
    }

    function addGroupBotMessage(type: string, content: string) {
        const _id = focus + Date.now();
        const message = {
            _id,
            type,
            content,
            createTime: Date.now(),
            from: {
                _id: linkman._id,
                username: defaultBotName || 'AI',
                avatar: window.localStorage.getItem('botAvatar'),
                tag: 'bot',
            },
            loading: true,
        };
        action.addLinkmanMessage(focus, message);
        return _id;
    }

    function addSelfMessage(type: string, content: string) {
        const _id = focus + Date.now();
        const message = {
            _id,
            type,
            content,
            createTime: Date.now(),
            from: {
                _id: selfId,
                username,
                avatar,
                tag,
            },
            loading: true,
            percent: type === 'image' || type === 'file' ? 0 : 100,
        };
        action.addLinkmanMessage(focus, message);
        return _id;
    }

    // eslint-disable-next-line react/destructuring-assignment
    async function handleSendMessage(
        localId: string,
        type: string,
        content: string,
        linkmanId = focus,
    ) {
        sendingLockRef.current = true;
        const connected = await ensureSocketConnected();
        if (!connected) {
            sendingLockRef.current = false;
            action.updateMessage(focus, localId, {
                loading: false,
                sendFailed: true,
            });
            Message.error('当前离线，正在尝试重连，请稍后点击重试');
            return;
        }
        const [error, message] = await sendMessage(
            linkmanId,
            type,
            content,
        );
        if (error) {
            sendingLockRef.current = false;
            action.updateMessage(focus, localId, {
                loading: false,
                sendFailed: true,
            });
            Message.error('发送失败，请检查网络后重试，可点击消息旁「重试」按钮重新发送');
            return;
        }
        sendingLockRef.current = false;
        if ($input.current) {
            $input.current.value = '';
            $input.current.setSelectionRange(0, 0);
            setTextAreaHeight($input.current, minHeight, maxHeight);
        }
        setExpressions([]);
        message.loading = false;
        message.sendFailed = false;
        action.updateMessage(focus, localId, message);
        if (linkman.type !== 'group' && linkman.tag === 'bot') {
            const botMessageId = addBotMessage(
                'text',
                '',
            );
            const [botErr, botMsg] = await sendBotMessage(
                linkmanId,
                type,
                content,
            );
            if (!botErr) {
                action.updateMessage(focus, botMessageId, botMsg);
            }
        }
        const botNameForGroup = defaultBotName || 'AI';
        const contentMentionsBot = botNameForGroup && content.includes(`@${botNameForGroup}`);
        if (linkman.type === 'group' && contentMentionsBot) {
            if (groupAISwitch) {
                const botMessageId = addGroupBotMessage(
                    'text',
                    '',
                );
                const [groupBotErr, groupBotMsg] = await sendGroupBotMessage(
                    linkmanId,
                    type,
                    content,
                );
                if (!groupBotErr) {
                    action.updateMessage(focus, botMessageId, groupBotMsg);
                }
            } else {
                Message.warning('管理员已关闭群聊 AI，@ 机器人不会触发回复');
            }
        }
    }

    function sendImageMessage(image: string): void;
    function sendImageMessage(image: ReadFileResult): void;
    function sendImageMessage(image: string | ReadFileResult) {
        if (typeof image === 'string') {
            const id = addSelfMessage('image', image);
            handleSendMessage(id, 'image', image);
            toggleExpressionDialog(false);
            return;
        }

        if (image.length > config.maxImageSize) {
            Message.warning('要发送的图片过大', 3);
            return;
        }

        // @ts-ignore
        const ext = image.type.split('/').pop().toLowerCase();
        const url = URL.createObjectURL(image.result);

        const img = new Image();
        img.onload = async () => {
            const id = addSelfMessage(
                'image',
                `${url}?width=${img.width}&height=${img.height}`,
            );
            try {
                const imageUrl = await uploadFile(
                    image.result as Blob,
                    `ImageMessage/${selfId}_${Date.now()}.${ext}`,
                    (percent) => action.updateMessage(focus, id, { percent }),
                );
                handleSendMessage(
                    id,
                    'image',
                    `${imageUrl}?width=${img.width}&height=${img.height}`,
                    focus,
                );
            } catch (err) {
                console.error(err);
                action.updateMessage(focus, id, { loading: false, sendFailed: true });
                Message.error('上传图片失败');
            }
        };
        img.src = url;
    }

    async function sendFileMessage(file: ReadFileResult) {
        if (file.length > config.maxFileSize) {
            Message.warning('要发送的文件过大', 3);
            return;
        }

        const id = addSelfMessage(
            'file',
            JSON.stringify({
                filename: file.filename,
                size: file.length,
                ext: file.ext,
            }),
        );
        try {
            const fileUrl = await uploadFile(
                file.result as Blob,
                `FileMessage/${selfId}_${Date.now()}.${file.ext}`,
                (percent) => action.updateMessage(focus, id, { percent }),
            );
            handleSendMessage(
                id,
                'file',
                JSON.stringify({
                    fileUrl,
                    filename: file.filename,
                    size: file.length,
                    ext: file.ext,
                }),
                focus,
            );
        } catch (err) {
            console.error(err);
            action.updateMessage(focus, id, { loading: false, sendFailed: true });
            Message.error('上传文件失败');
        }
    }

    async function handleSendImage() {
        if (!connect) {
            return Message.error('发送消息失败, 您当前处于离线状态');
        }
        const image = await readDiskFile(
            'blob',
            'image/png,image/jpeg,image/gif',
        );
        if (!image) {
            return null;
        }
        sendImageMessage(image);
        return null;
    }
    async function handleSendFile() {
        if (!connect) {
            Message.error('发送消息失败, 您当前处于离线状态');
            return;
        }
        const file = await readDiskFile('blob');
        if (!file) {
            return;
        }
        sendFileMessage(file);
    }

    function handleFeatureMenuClick({
        key,
        domEvent,
    }: {
        key: string;
        domEvent: any;
    }) {
        // Quickly hitting the Enter key causes the button to repeatedly trigger the problem
        if (domEvent.keyCode === 13) {
            return;
        }
        setAddMenuOpen(false);
        switch (key) {
            case 'image': {
                handleSendImage();
                break;
            }
            case 'file': {
                handleSendFile();
                break;
            }
            default:
        }
    }

    async function handlePaste(e: any) {
        if (!connect) {
            e.preventDefault();
            return Message.error('发送消息失败, 您当前处于离线状态');
        }
        const { items, types } =
            e.clipboardData || e.originalEvent.clipboardData;

        // 如果包含文件内容，加入待发送列表，不立即发送
        if (types.indexOf('Files') > -1) {
            for (let index = 0; index < items.length; index++) {
                const item = items[index];
                if (item.kind === 'file') {
                    const file = item.getAsFile();
                    if (!file) continue;
                    const isImage = file.type.startsWith('image/');
                    if (isImage) {
                        const reader = new FileReader();
                        reader.onloadend = function handleLoad() {
                            const image = new Image();
                            image.onload = async () => {
                                try {
                                    const imageBlob = await compressImage(
                                        image,
                                        file.type,
                                        1,
                                    );
                                    const data: ReadFileResult = {
                                        filename: file.name,
                                        ext: (imageBlob?.type.split('/').pop() || 'png') as string,
                                        length: imageBlob?.size || 0,
                                        type: imageBlob?.type || file.type,
                                        result: imageBlob,
                                    };
                                    if (data.length > config.maxImageSize) {
                                        Message.warning('要发送的图片过大', 3);
                                        return;
                                    }
                                    const previewUrl = URL.createObjectURL(imageBlob);
                                    setPendingAttachments((prev) => [
                                        ...prev,
                                        { type: 'image', data, previewUrl },
                                    ]);
                                } catch (err) {
                                    Message.error('图片处理失败');
                                }
                            };
                            // eslint-disable-next-line react/no-this-in-sfc
                            image.src = this.result as string;
                        };
                        reader.readAsDataURL(file);
                    } else {
                        const ext = file.name.includes('.')
                            ? file.name.split('.').pop()!.toLowerCase()
                            : 'bin';
                        if (file.size > config.maxFileSize) {
                            Message.warning('要发送的文件过大', 3);
                            continue;
                        }
                        setPendingAttachments((prev) => [
                            ...prev,
                            {
                                type: 'file',
                                data: {
                                    filename: file.name,
                                    ext,
                                    type: file.type,
                                    result: file,
                                    length: file.size,
                                },
                            },
                        ]);
                    }
                }
            }
            e.preventDefault();
        }
        return null;
    }

    function removePendingAttachment(index: number) {
        setPendingAttachments((prev) => {
            const item = prev[index];
            if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
            return prev.filter((_, i) => i !== index);
        });
    }

    /** 发送单张图片（用于组合发送） */
    function sendOneImage(data: ReadFileResult): Promise<void> {
        const ext = data.type.split('/').pop()?.toLowerCase() || 'png';
        const url = URL.createObjectURL(data.result as Blob);
        const img = new Image();
        return new Promise((resolve, reject) => {
            img.onload = async () => {
                const id = addSelfMessage(
                    'image',
                    `${url}?width=${img.width}&height=${img.height}`,
                );
                try {
                    const imageUrl = await uploadFile(
                        data.result as Blob,
                        `ImageMessage/${selfId}_${Date.now()}.${ext}`,
                        (percent) => action.updateMessage(focus, id, { percent }),
                    );
                    await handleSendMessage(
                        id,
                        'image',
                        `${imageUrl}?width=${img.width}&height=${img.height}`,
                        focus,
                    );
                    resolve();
                } catch (err) {
                    console.error(err);
                    action.updateMessage(focus, id, { loading: false, sendFailed: true });
                    Message.error('上传图片失败');
                    resolve();
                }
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                resolve();
            };
            img.src = url;
        });
    }

    /** 发送单个文件（用于组合发送） */
    async function sendOneFile(data: ReadFileResult): Promise<void> {
        const id = addSelfMessage(
            'file',
            JSON.stringify({
                filename: data.filename,
                size: data.length,
                ext: data.ext,
            }),
        );
        try {
            const fileUrl = await uploadFile(
                data.result as Blob,
                `FileMessage/${selfId}_${Date.now()}.${data.ext}`,
                (percent) => action.updateMessage(focus, id, { percent }),
            );
            await handleSendMessage(
                id,
                'file',
                JSON.stringify({
                    fileUrl,
                    filename: data.filename,
                    size: data.length,
                    ext: data.ext,
                }),
                focus,
            );
        } catch (err) {
            console.error(err);
            action.updateMessage(focus, id, { loading: false, sendFailed: true });
            Message.error('上传文件失败');
        }
    }

    /** 组合发送：先发所有待发送的图片/文件，再发文本 */
    async function sendComposedMessage() {
        if (!connect) {
            Message.error('发送消息失败, 您当前处于离线状态');
            return null;
        }
        if (sendingLockRef.current) return null;
        const text = ($input.current?.value ?? '').trim();
        if (pendingAttachments.length === 0 && !text) return null;

        // 邀请链接单独处理
        if (
            pendingAttachments.length === 0 &&
            text.startsWith(window.location.origin) &&
            text.match(/\/invite\/group\/[\w\d]+/)
        ) {
            const groupId = text.replace(
                `${window.location.origin}/invite/group/`,
                '',
            );
            const id = addSelfMessage(
                'inviteV2',
                JSON.stringify({
                    inviter: selfId,
                    inviterName: username,
                    group: groupId,
                    groupName: '',
                }),
            );
            $input.current!.value = '';
            setInputHasContent(false);
            setTextAreaHeight($input.current, minHeight, maxHeight);
            setExpressions([]);
            handleSendMessage(id, 'inviteV2', groupId);
            return null;
        }

        // 先发送所有待发送的图片/文件
        const toSend = [...pendingAttachments];
        setPendingAttachments([]);
        for (const item of toSend) {
            if (item.type === 'image') {
                await sendOneImage(item.data);
            } else {
                await sendOneFile(item.data);
            }
        }

        // 再发送文本
        if (text) {
            let finalText = text;
            if (quotedMessage) {
                const rawPreview =
                    quotedMessage.type === 'text'
                        ? quotedMessage.content || ''
                        : `[${quotedMessage.type} 消息]`;
                const preview = rawPreview
                    .replace(/\s+/g, ' ')
                    .slice(0, 80);
                finalText = `> 引用 ${quotedMessage.username}: ${preview}\n\n${text}`;
            }
            const id = addSelfMessage('text', xss(finalText));
            $input.current!.value = '';
            setInputHasContent(false);
            setTextAreaHeight($input.current, minHeight, maxHeight);
            setExpressions([]);
            handleSendMessage(id, 'text', finalText);
        }
        if (quotedMessage) {
            action.setStatus('quotedMessage', null);
        }
        return null;
    }

    function sendTextMessage() {
        return sendComposedMessage();
    }

    async function getExpressionsFromContent() {
        if (!$input.current) return;
        const content = $input.current.value.trim();
        if (searchExpressionTimer) {
            clearTimeout(searchExpressionTimer);
        }
        // @ts-ignore
        searchExpressionTimer = setTimeout(async () => {
            if (!$input.current) return;
            if (content.length >= 1 && content.length <= 4) {
                const [err, res] = await fetch(
                    'searchExpression',
                    { keywords: content, limit: 10 },
                    { toast: false },
                );
                if (!err && $input.current?.value.trim() === content) {
                    setExpressions(res);
                    return;
                }
            }
            setExpressions([]);
        }, 500);
    }

    async function handleInputKeyDown(e: any) {
        const { shiftKey, key } = e;
        if (!shiftKey && key === 'Enter' && !inputIME) {
            e.preventDefault();
            sendTextMessage();
        }
        if (e.key === 'Tab') {
            e.preventDefault();
        } else if (e.altKey && (e.key === 'd' || e.key === '∂')) {
            toggleExpressionDialog(true);
            e.preventDefault();
        } else if (e.key === '@') {
            // 如果按下@建, 则进入@计算模式
            // @ts-ignore
            if ($input.current && !/@/.test($input.current.value)) {
                setAt({
                    enable: true,
                    content: '',
                });
            }
            // eslint-disable-next-line react/destructuring-assignment
        } else if (at.enable) {
            // 如果处于@计算模式
            const { key } = e;
            // 延时, 以便拿到新的value和ime状态
            setTimeout(() => {
                // 如果@已经被删掉了, 退出@计算模式
                // @ts-ignore
                if (!$input.current || !/@/.test($input.current.value)) {
                    setAt({ enable: false, content: '' });
                    return;
                }
                // 如果是输入中文, 并且不是空格键, 忽略输入
                if (inputIME && key !== ' ') {
                    return;
                }
                // 如果是不是输入中文, 并且是空格键, 则@计算模式结束
                if (!inputIME && key === ' ') {
                    setAt({ enable: false, content: '' });
                    return;
                }

                // 如果是正在输入中文, 则直接返回, 避免取到拼音字母
                if (inputIME) {
                    return;
                }
                // @ts-ignore
                const regexResult = /@([^ ]*)/.exec($input.current.value);
                if (regexResult) {
                    setAt({ enable: true, content: regexResult[1] });
                }
            }, 100);
        } else if (enableSearchExpression) {
            // Set timer to get current input value
            setTimeout(() => {
                if (inputIME) {
                    return;
                }
                if ($input.current?.value) {
                    getExpressionsFromContent();
                } else {
                    clearTimeout(searchExpressionTimer);
                    setExpressions([]);
                }
            });
        }
    }

    function handleBeforeInput(e: any) {
        if (!isMobile) {
            return;
        }
        if (e.inputType === 'insertLineBreak' && !inputIME) {
            e.preventDefault();
            sendTextMessage();
        }
    }

    function getSuggestion(): typeof linkman.onlineMembers {
        if (!at.enable || linkman.type !== 'group') {
            return [];
        }
        const botName = defaultBotName || 'AI';
        const regex = new RegExp(`^${at.content.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
        const filtered = (linkman.onlineMembers || []).filter((member) =>
            regex.test(member.user.username),
        );
        const botFirst = [...filtered].sort((a, b) => {
            if (a.user.username === botName) return -1;
            if (b.user.username === botName) return 1;
            return 0;
        });
        return botFirst;
    }

    function replaceAt(targetUsername: string) {
        if (!$input.current) return;
        // @ts-ignore
        $input.current.value = $input.current.value.replace(
            `@${at.content}`,
            `@${targetUsername} `,
        );
        setAt({
            enable: false,
            content: '',
        });
        // @ts-ignore
        $input.current.focus();
    }

    function handleClickExpressionImage(
        image: string,
        width: number,
        height: number,
    ) {
        sendImageMessage(`${image}?width=${width}&height=${height}`);
        setExpressions([]);
        if ($input.current) {
            $input.current.value = '';
            setInputHasContent(false);
            setTextAreaHeight($input.current, minHeight, maxHeight);
        }
    }

    return (
        <div className={Style.chatInput} {...aero}>
            <div className={Style.leftActions}>
                <Dropdown
                    trigger={['click']}
                    visible={expressionDialog}
                    onVisibleChange={toggleExpressionDialog}
                    overlay={
                        <div className={Style.expressionDropdown}>
                            <ExpressionAsync
                                onSelectText={handleSelectExpression}
                                onSelectImage={sendImageMessage}
                            />
                        </div>
                    }
                    animation="slide-up"
                    placement="topLeft"
                    getPopupContainer={() => document.body}
                >
                    <IconButton
                        className={`${Style.iconButton} ${Style.expressionIcon}`}
                        width={32}
                        height={32}
                        icon="expression"
                        iconSize={25}
                    />
                </Dropdown>
                <div className={Style.addMenuWrap} ref={addTriggerRef}>
                    <IconButton
                        className={`${Style.iconButton} ${Style.addIcon}`}
                        width={32}
                        height={32}
                        icon="add"
                        iconSize={25}
                        onClick={() => setAddMenuOpen((v) => !v)}
                    />
                    {addMenuOpen && (
                        <>
                            <div
                                className={Style.addMenuBackdrop}
                                role="button"
                                tabIndex={-1}
                                onClick={() => setAddMenuOpen(false)}
                                onKeyDown={(e) =>
                                    e.key === 'Escape' && setAddMenuOpen(false)
                                }
                                aria-label="关闭"
                            />
                            <div className={Style.featureDropdown}>
                                <Menu onClick={handleFeatureMenuClick}>
                                    <MenuItem key="image">发送图片</MenuItem>
                                    <MenuItem key="file">发送文件</MenuItem>
                                </Menu>
                            </div>
                        </>
                    )}
                </div>
            </div>
            <form
                className={Style.form}
                autoComplete="off"
                onSubmit={(e) => e.preventDefault()}
            >
                {pendingAttachments.length > 0 && (
                    <div className={Style.pendingAttachments}>
                        {pendingAttachments.map((item, index) => (
                            <div
                                key={`${item.type}-${index}`}
                                className={Style.pendingAttachmentItem}
                            >
                                {item.type === 'image' && item.previewUrl ? (
                                    <img
                                        src={item.previewUrl}
                                        alt=""
                                        className={Style.pendingAttachmentThumb}
                                    />
                                ) : item.type === 'file' ? (
                                    <span className={Style.pendingAttachmentFile}>
                                        📎 {item.data.filename}
                                    </span>
                                ) : null}
                                <button
                                    type="button"
                                    className={Style.pendingAttachmentRemove}
                                    onClick={() => removePendingAttachment(index)}
                                    aria-label="移除"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                {quotedMessage && (
                    <div className={Style.quotePreview}>
                        <div className={Style.quoteContent}>
                            <span className={Style.quoteLabel}>
                                引用 {quotedMessage.username}：
                            </span>
                            <span className={Style.quoteText}>
                                {quotedMessage.content
                                    .replace(/\s+/g, ' ')
                                    .slice(0, 80)}
                            </span>
                        </div>
                        <button
                            type="button"
                            className={Style.quoteClose}
                            onClick={() => action.setStatus('quotedMessage', null)}
                            aria-label="取消引用"
                        >
                            ×
                        </button>
                    </div>
                )}
                {at.enable &&
                    linkman.type === 'group' &&
                    getSuggestion().length > 0 && (
                    <div
                        className={Style.atPanel}
                        data-float-panel="true"
                        role="listbox"
                        aria-label="选择要 @ 的成员"
                    >
                        {getSuggestion().map((member) => (
                            <div
                                key={member.user._id}
                                className={Style.atPanelItem}
                                role="option"
                                onClick={() => replaceAt(member.user.username)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        replaceAt(member.user.username);
                                    }
                                }}
                                tabIndex={0}
                            >
                                <Avatar
                                    size={28}
                                    src={member.user.avatar || avatarFailback}
                                />
                                <span className={Style.atPanelUsername}>
                                    {member.user.username}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
                <textarea
                    className={Style.input}
                    autoFocus={!isMobile}
                    placeholder={isMobile ? "" : "Enter 发送，Shift + Enter 换行"}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    enterKeyHint={isMobile ? 'send' : 'enter'}
                    ref={$input}
                    onBeforeInput={handleBeforeInput}
                    onKeyDown={handleInputKeyDown}
                    onPaste={handlePaste}
                    onCompositionStart={() => {
                        inputIME = true;
                    }}
                    onCompositionEnd={() => {
                        inputIME = false;
                    }}
                    onFocus={() => {
                        toggleInputFocus(true);
                        const v = ($input.current?.value ?? '').trim();
                        setInputHasContent(v.length > 0);
                    }}
                    onBlur={() => toggleInputFocus(false)}
                    onInput={({ currentTarget }) => {
                        setTextAreaHeight(currentTarget, minHeight, maxHeight);
                        setInputHasContent((currentTarget.value || '').trim().length > 0);
                    }}
                />
                {/* 清除按钮已移除，保持输入区域干净简洁 */}
            </form>
            {expressions.length > 0 && (
                <div className={expressionList}>
                    {expressions.map(({ image, width, height }) => (
                        <div className={expressionImageContainer}>
                            <img
                                className={expressionImage}
                                src={image}
                                key={image}
                                alt="表情图"
                                onClick={() =>
                                    handleClickExpressionImage(
                                        image,
                                        width,
                                        height,
                                    )
                                }
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default ChatInput;
