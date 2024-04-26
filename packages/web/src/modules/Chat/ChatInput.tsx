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
import Avatar from '../../components/Avatar';
import Message from '../../components/Message';
import { Menu, MenuItem } from '../../components/Menu';
import { State } from '../../state/reducer';
import {
    sendMessage,
    sendBotMessage,
    sendGroupBotMessage,
} from '../../service';
import Tooltip from '../../components/Tooltip';
import useAero from '../../hooks/useAero';

interface InputAreaProps {
    readonly busy: boolean;
    readonly minHeight: number;
    readonly maxHeight?: number;
    readonly onSubmit: (prompt: string) => void;
}

const expressionList = css`
  display: flex;
  width: 100%;
  height: 80px;
  position: absolute;
  left: 0;
  top: -80px;
  background-color: inherit;
  overflow-x: auto;
`;
const expressionImageContainer = css`
  min-width: 80px;
  height: 80px;
`;
const expressionImage = css`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const ExpressionAsync = loadable(
    () =>
        // @ts-ignore
        import(/* webpackChunkName: "expression" */ './Expression'),
);
const CodeEditorAsync = loadable(
    // @ts-ignore
    () => import(/* webpackChunkName: "code-editor" */ './CodeEditor'),
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
    const voiceSwitch = useSelector((state: State) => state.status.voiceSwitch);
    const groupAISwitch = useSelector(
        (state: State) => state.status.groupAISwitch,
    );
    const selfVoiceSwitch = useSelector(
        (state: State) => state.status.selfVoiceSwitch,
    );
    const enableSearchExpression = useSelector(
        (state: State) => state.status.enableSearchExpression,
    );
    const [expressionDialog, toggleExpressionDialog] = useState(false);
    const [codeEditorDialog, toggleCodeEditorDialog] = useState(false);
    const [inputFocus, toggleInputFocus] = useState(false);
    const [at, setAt] = useState({ enable: false, content: '' });
    const $input = useRef<HTMLInputElement>(null);
    const aero = useAero();
    const [expressions, setExpressions] = useState<
        { image: string; width: number; height: number }[]
    >([]);

    const { minHeight, maxHeight } = props;

    function focusInput(e: KeyboardEvent) {
        if ($input.current.value === '' && e.key === 'Enter') {
            e.preventDefault();
            // @ts-ignore
            $input.current.focus(e);
        }
    }
    useEffect(() => {
        window.addEventListener('keydown', focusInput);
        return () => window.removeEventListener('keydown', focusInput);
    }, []);

    const setTextAreaHeight = (
        current: HTMLTextAreaElement | null,
        minHeight: number = 40,
        maxHeight: number = 400,
    ) => {
        current!.style.height = '0px';
        current!.style.height =
            current!.scrollHeight < maxHeight
                ? `${
                    current!.scrollHeight > minHeight
                        ? current!.scrollHeight
                        : minHeight
                }px`
                : `${maxHeight}px`;
    };

    useEffect(() => {
        setExpressions([]);
    }, [enableSearchExpression]);

    if (!isLogin) {
        return (
            <div className={Style.chatInput}>
                <p className={Style.guest}>
                    <b
                        className={Style.guestLogin}
                        onClick={() =>
                            action.setStatus('loginRegisterDialogVisible', true)
                        }
                        role="button"
                    >
                        注册 / 登录
                    </b>
                </p>
            </div>
        );
    }

    /**
     * 插入文本到输入框光标处
     * @param value 要插入的文本
     */
    function insertAtCursor(value: string) {
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
                _id: linkman._id,
                username: process.env.DEFAULT_BOT_NAME,
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
        // @ts-ignore
        if (type !== 'text') {
            action.addLinkmanMessage(focus, message);
        }
        // 停用
        return _id;

        if (selfVoiceSwitch && type === 'text') {
            const text = content
                .replace(
                    /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)/g,
                    '',
                )
                .replace(/#/g, '');

            if (text.length > 0 && text.length <= 100) {
                voice.push(text, Math.random().toString());
            }
        }

        return _id;
    }

    // eslint-disable-next-line react/destructuring-assignment
    async function handleSendMessage(
        localId: string,
        type: string,
        content: string,
        linkmanId = focus,
    ) {
        // if (linkman.unread > 0) {
        //     action.setLinkmanProperty(linkman._id, 'unread', 0);
        // }
        let prefixContent = content;
        if (
            linkman.type === 'group' &&
            status.groupAISwitch &&
            type === 'text'
        ) {
            prefixContent = `❓${content}`;
        }
        const [error, message] = await sendMessage(
            linkmanId,
            type,
            prefixContent,
        );
        if (error) {
            console.log(error);
            action.deleteMessage(focus, localId, true);
            return;
        }
        $input.current.value = '';
        $input.current.setSelectionRange(0, 0);
        setExpressions([]);
        message.loading = false;
        action.updateMessage(focus, localId, message);
        setTextAreaHeight($input.current, minHeight, maxHeight);
        if (linkman.type !== 'group' && linkman.tag === 'bot') {
            const botMessageId = addBotMessage(
                'text',
                `${linkman.name}正在思考中...`,
            );
            const [error, message] = await sendBotMessage(
                linkmanId,
                type,
                content,
            );
            if (error) {
                console.log(error);
                return;
            }
            action.updateMessage(focus, botMessageId, message);
        }
        if (linkman.type === 'group' && status.groupAISwitch) {
            const botMessageId = addGroupBotMessage(
                'text',
                `${process.env.DEFAULT_BOT_NAME}正在回复${username}...`,
            );
            const [error, message] = await sendGroupBotMessage(
                linkmanId,
                type,
                content,
            );
            if (error) {
                console.log(error);
                return;
            }
            action.updateMessage(focus, botMessageId, message);
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
                );
                handleSendMessage(
                    id,
                    'image',
                    `${imageUrl}?width=${img.width}&height=${img.height}`,
                    focus,
                );
            } catch (err) {
                console.error(err);
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

        switch (key) {
            case 'image': {
                handleSendImage();
                break;
            }
            // case 'huaji': {
            //     sendHuaji();
            //     break;
            // }
            case 'code': {
                toggleCodeEditorDialog(true);
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
        // eslint-disable-next-line react/destructuring-assignment
        if (!connect) {
            e.preventDefault();
            return Message.error('发送消息失败, 您当前处于离线状态');
        }
        const { items, types } =
        e.clipboardData || e.originalEvent.clipboardData;

        // 如果包含文件内容
        if (types.indexOf('Files') > -1) {
            for (let index = 0; index < items.length; index++) {
                const item = items[index];
                if (item.kind === 'file') {
                    const file = item.getAsFile();
                    if (file) {
                        const reader = new FileReader();
                        reader.onloadend = function handleLoad() {
                            const image = new Image();
                            image.onload = async () => {
                                const imageBlob = await compressImage(
                                    image,
                                    file.type,
                                    1,
                                );
                                // @ts-ignore
                                sendImageMessage({
                                    filename: file.name,
                                    ext: imageBlob?.type.split('/').pop(),
                                    length: imageBlob?.size,
                                    type: imageBlob?.type,
                                    result: imageBlob,
                                });
                            };
                            // eslint-disable-next-line react/no-this-in-sfc
                            image.src = this.result as string;
                        };
                        reader.readAsDataURL(file);
                    }
                }
            }
            e.preventDefault();
        }
        return null;
    }

    function sendTextMessage() {
        if (!connect) {
            return Message.error('发送消息失败, 您当前处于离线状态');
        }
        // @ts-ignore
        const message = $input.current.value.trim();
        if (message.length === 0) {
            return null;
        }

        if (
            message.startsWith(window.location.origin) &&
            message.match(/\/invite\/group\/[\w\d]+/)
        ) {
            const groupId = message.replace(
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
            handleSendMessage(id, 'inviteV2', groupId);
        } else {
            const id = addSelfMessage('text', xss(message));
            handleSendMessage(id, 'text', message);
        }
        // @ts-ignore
        // $input.current.value = '';
        // $input.current.setSelectionRange(0, 0);
        // setExpressions([]);
        return null;
    }

    async function getExpressionsFromContent() {
        if ($input.current) {
            const content = $input.current.value.trim();
            if (searchExpressionTimer) {
                clearTimeout(searchExpressionTimer);
            }
            // @ts-ignore
            searchExpressionTimer = setTimeout(async () => {
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
            if (!/@/.test($input.current.value)) {
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
                if (!/@/.test($input.current.value)) {
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

    function getSuggestion() {
        if (!at.enable || linkman.type !== 'group') {
            return [];
        }
        return linkman.onlineMembers.filter((member) => {
            const regex = new RegExp(`^${at.content}`);
            if (regex.test(member.user.username)) {
                return true;
            }
            return false;
        });
    }

    function replaceAt(targetUsername: string) {
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

    function handleSendCode(language: string, rawCode: string) {
        if (!connect) {
            return Message.error('发送消息失败, 您当前处于离线状态');
        }

        if (rawCode === '') {
            return Message.warning('请输入内容');
        }

        const code = `@language=${language}@${rawCode}`;
        const id = addSelfMessage('code', code);
        handleSendMessage(id, 'code', code);
        toggleCodeEditorDialog(false);
        return null;
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
        }
    }

    return (
        <div className={Style.chatInput} {...aero}>
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
            >
                <IconButton
                    className={Style.iconButton}
                    width={32}
                    height={32}
                    icon="expression"
                    iconSize={25}
                />
            </Dropdown>
            {process.env.GROUP_AI_SWITCH === 'true' &&
                linkman.type === 'group' && (
                    <div className={Style.switch}>
                        <Switch
                            onChange={(value) => {
                                action.setStatus('groupAISwitch', value);
                                if (value) {
                                    Message.success('已开启自动回复');
                                } else {
                                    Message.info('已关闭自动回复');
                                }
                            }}
                            checked={groupAISwitch}
                        />
                    </div>
                )}
            <form
                className={Style.form}
                autoComplete="off"
                onSubmit={(e) => e.preventDefault()}
            >
                <textarea
                    className={Style.input}
                    autoFocus={!isMobile}
                    placeholder={isMobile ? "" : "Enter 发送，Shift + Enter 换行"}
                    ref={$input}
                    onKeyDown={handleInputKeyDown}
                    onPaste={handlePaste}
                    onCompositionStart={() => {
                        inputIME = true;
                    }}
                    onCompositionEnd={() => {
                        inputIME = false;
                    }}
                    onFocus={() => toggleInputFocus(true)}
                    onBlur={() => toggleInputFocus(false)}
                    onInput={({ currentTarget }) =>
                        setTextAreaHeight(currentTarget, minHeight, maxHeight)
                    }
                />
            </form>
            <Dropdown
                trigger={['click']}
                overlay={
                    <div className={Style.featureDropdown}>
                        <Menu onClick={handleFeatureMenuClick}>
                            <MenuItem key="code">发送代码</MenuItem>
                            <MenuItem key="image">发送图片</MenuItem>
                            <MenuItem key="file">发送文件</MenuItem>
                        </Menu>
                    </div>
                }
                animation="slide-up"
                placement="topLeft"
            >
                <IconButton
                    className={Style.iconButton}
                    width={32}
                    height={32}
                    icon="add"
                    iconSize={25}
                />
            </Dropdown>
            {/* <IconButton */}
            {/*    className={Style.iconButton} */}
            {/*    width={32} */}
            {/*    height={32} */}
            {/*    icon="send" */}
            {/*    iconSize={25} */}
            {/*    onClick={sendTextMessage} */}
            {/* /> */}

            <div className={Style.atPanel}>
                {at.enable &&
                    getSuggestion().map((member) => (
                        <div
                            className={Style.atUserList}
                            key={member.user._id}
                            onClick={() => replaceAt(member.user.username)}
                            role="button"
                        >
                            <Avatar size={24} src={member.user.avatar} />
                            <p className={Style.atText}>
                                {member.user.username}
                            </p>
                        </div>
                    ))}
            </div>

            {codeEditorDialog && (
                <CodeEditorAsync
                    visible={codeEditorDialog}
                    onClose={() => toggleCodeEditorDialog(false)}
                    onSend={handleSendCode}
                />
            )}

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
