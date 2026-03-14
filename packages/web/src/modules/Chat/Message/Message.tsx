import React, { Component, createRef } from 'react';
import pureRender from 'pure-render-decorator';
import { connect } from 'react-redux';

import Time from '@bulita/utils/time';
import {
    getRandomColor,
    getPerRandomColor,
} from '@bulita/utils/getRandomColor';
import client from '@bulita/config/client';
import Style from './Message.less';
import Avatar from '../../../components/Avatar';
import { TextMessage, TextMessageBot } from './TextMessage';
import { ShowUserOrGroupInfoContext } from '../../../context';
import ImageMessage from './ImageMessage';
import CodeMessage from './CodeMessage';
import UrlMessage from './UrlMessage';
import InviteMessageV2 from './InviteMessageV2';
import SystemMessage from './SystemMessage';
import store from '../../../state/store';
import { ActionTypes, DeleteMessagePayload } from '../../../state/action';
import { deleteMessage } from '../../../service';
import IconButton from '../../../components/IconButton';
import Dropdown from '../../../components/Dropdown';
import { Menu, MenuItem } from '../../../components/Menu';
import { State } from '../../../state/reducer';
import Tooltip from '../../../components/Tooltip';
import MessageToast from '../../../components/Message';
import themes from '../../../themes';
import FileMessage from './FileMessage';
import UserBadge from '../../../components/UserBadge';

const { dispatch } = store;

interface MessageProps {
    id: string;
    linkmanId: string;
    isSelf: boolean;
    userId: string;
    avatar: string;
    username: string;
    originUsername: string;
    tag: string;
    time: string;
    type: string;
    content: string;
    loading: boolean;
    percent: number;
    sendFailed?: boolean;
    onRetry?: (linkmanId: string, messageId: string) => void;
    shouldScroll: boolean;
    tagColorMode: string;
    isAdmin?: boolean;
    /** 发送者的注册时间（用于显示UserBadge） */
    senderCreateTime?: string | null;
    /** 发送者是否在线（用于点击头像弹窗） */
    senderIsOnline?: boolean;
    /** 发送者最后在线时间（用于点击头像弹窗） */
    senderLastLoginTime?: string | null;
}

interface MessageState {
    showButtonList: boolean;
}

/**
 * Message组件用hooks实现有些问题
 * 功能上要求Message组件渲染后触发滚动, 实测中发现在useEffect中触发滚动会比在componentDidMount中晚
 * 具体表现就是会先看到历史消息, 然后一闪而过再滚动到合适的位置
 */
@pureRender
class Message extends Component<MessageProps, MessageState> {
    $container = createRef<HTMLDivElement>();

    constructor(props: MessageProps) {
        super(props);
        this.state = {
            showButtonList: false,
        };
    }

    componentDidMount() {
        const { shouldScroll } = this.props;
        if (shouldScroll) {
            // @ts-ignore
            this.$container.current.scrollIntoView();
        }
    }

    handleMouseEnter = () => {
        const { type } = this.props;
        if (type === 'system') {
            return;
        }
        this.setState({ showButtonList: true });
    };

    handleMouseLeave = () => {
        this.setState({ showButtonList: false });
    };

    /**
     * 复制消息内容到剪贴板
     */
    handleCopyMessage = async () => {
        const { type, content } = this.props;
        let text = '';
        try {
            switch (type) {
                case 'text':
                    text = content;
                    break;
                case 'image':
                    text = content.includes('?') ? content.split('?')[0] : content;
                    if (text.startsWith('blob:') || text.startsWith('data:')) {
                        text = '[图片]';
                    }
                    break;
                case 'file': {
                    const parsed = JSON.parse(content || '{}');
                    text = parsed.fileUrl ? `${parsed.filename}\n${parsed.fileUrl}` : parsed.filename || '[文件]';
                    break;
                }
                case 'code':
                    text = content.replace(/^@language=[^@]+@/, '');
                    break;
                case 'url':
                    text = content;
                    break;
                case 'system':
                    text = content;
                    break;
                default:
                    text = content || '';
            }
            if (text && navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                MessageToast.success('已复制到剪贴板');
            }
        } catch (err) {
            MessageToast.error('复制失败');
        }
    };

    /**
     * 管理员撤回消息
     */
    handleDeleteMessage = async () => {
        const { id, linkmanId, loading, isAdmin } = this.props;
        if (loading) {
            dispatch({
                type: ActionTypes.DeleteMessage,
                payload: {
                    linkmanId,
                    messageId: id,
                    shouldDelete: isAdmin,
                } as DeleteMessagePayload,
            });
            return;
        }

        const isSuccess = await deleteMessage(id);
        if (isSuccess) {
            dispatch({
                type: ActionTypes.DeleteMessage,
                payload: {
                    linkmanId,
                    messageId: id,
                    shouldDelete: isAdmin,
                } as DeleteMessagePayload,
            });
            this.setState({ showButtonList: false });
        }
    };

    handleClickAvatar(showUserInfo: (userinfo: any) => void) {
        const { isSelf, userId, type, username, avatar, senderIsOnline, senderLastLoginTime } = this.props;
        if (!isSelf && type !== 'system') {
            showUserInfo({
                _id: userId,
                username,
                avatar,
                isOnline: senderIsOnline,
                lastLoginTime: senderLastLoginTime,
            });
        }
    }

    formatTime() {
        const { time } = this.props;
        const messageTime = new Date(time);
        const nowTime = new Date();
        
        // 检查日期是否有效
        if (isNaN(messageTime.getTime())) {
            return '';
        }
        
        if (Time.isToday(nowTime, messageTime)) {
            return Time.getHourMinute(messageTime);
        }
        if (Time.isYesterday(nowTime, messageTime)) {
            return `昨天 ${Time.getHourMinute(messageTime)}`;
        }
        return `${Time.getMonthDate(messageTime)} ${Time.getHourMinute(
            messageTime,
        )}`;
    }

    renderContent() {
        const { type, content, loading, percent, originUsername, tag } =
            this.props;
        switch (type) {
            case 'text': {
                if (tag === 'bot') {
                    return <TextMessageBot content={content} />;
                }
                return <TextMessage content={content} />;
            }
            case 'image': {
                return (
                    <ImageMessage
                        src={content}
                        loading={loading}
                        percent={percent}
                    />
                );
            }
            case 'file': {
                return <FileMessage file={content} percent={percent} />;
            }
            case 'code': {
                return <CodeMessage code={content} />;
            }
            case 'url': {
                return <UrlMessage url={content} />;
            }
            case 'inviteV2': {
                return <InviteMessageV2 inviteInfo={content} />;
            }
            case 'system': {
                return (
                    <SystemMessage
                        message={content}
                        username={originUsername}
                    />
                );
            }
            default:
                return <div className="unknown">不支持的消息类型</div>;
        }
    }

    render() {
        const { isSelf, avatar, tag, tagColorMode, username, type, content, loading, sendFailed, onRetry, linkmanId, id, isAdmin, senderCreateTime } =
            this.props;
        const { showButtonList } = this.state;

        let tagColor = `rgb(${themes.default.primaryColor})`;
        if (tagColorMode === 'fixedColor') {
            tagColor = getRandomColor(tag);
        } else if (tagColorMode === 'randomColor') {
            tagColor = getPerRandomColor(username);
        }

        return (
            <div
                className={`${Style.message} ${isSelf ? Style.self : ''}`}
                ref={this.$container}
            >
                <ShowUserOrGroupInfoContext.Consumer>
                    {(context) => (
                        <Avatar
                            className={Style.avatar}
                            src={avatar}
                            size={44}
                            onClick={() =>
                                // @ts-ignore
                                this.handleClickAvatar(context.showUserInfo)
                            }
                        />
                    )}
                </ShowUserOrGroupInfoContext.Consumer>
                <div className={Style.right}>
                    <div className={Style.nicknameTimeBlock}>
                        {tag && (
                            <span className={tag === '群主' ? Style.creatorTagInMessage : Style.tag}>
                                {tag === 'bot' ? '机器人' : tag}
                            </span>
                        )}
                        <span className={Style.nickname}>{username}</span>
                        {!isSelf && type !== 'system' && tag !== 'bot' && senderCreateTime && (
                            <UserBadge createTime={senderCreateTime} />
                        )}
                        <span className={Style.time}>{this.formatTime()}</span>
                    </div>
                    <div
                        className={Style.contentButtonBlock}
                        onMouseEnter={this.handleMouseEnter}
                        onMouseLeave={this.handleMouseLeave}
                    >
<div
                        className={
                            type === 'image'
                                ? Style.imageContent
                                : Style.content
                        }
                    >
                            {this.renderContent()}
                        </div>
                        {isSelf && loading && (
                            <span className={Style.sendStatus}>
                                <span className={Style.sendStatusDot} />
                                发送中
                            </span>
                        )}
                        {isSelf && sendFailed && onRetry && (
                            <span className={Style.sendFailed}>
                                <span className={Style.sendFailedText}>发送失败</span>
                                <button
                                    type="button"
                                    className={Style.retryButton}
                                    onClick={() => onRetry(linkmanId, id)}
                                >
                                    重试
                                </button>
                            </span>
                        )}
                        {showButtonList && (
                            <div className={Style.buttonList}>
                                <Tooltip
                                    placement={isSelf ? 'left' : 'right'}
                                    mouseEnterDelay={0.3}
                                    overlay={<span>复制</span>}
                                >
                                    <button
                                        type="button"
                                        className={Style.copyButton}
                                        onClick={this.handleCopyMessage}
                                        aria-label="复制"
                                        title="复制"
                                    >
                                        <svg
                                            width="11"
                                            height="11"
                                            viewBox="0 0 12 12"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                        >
                                            <path
                                                d="M4 2C4 1.44772 4.44772 1 5 1H9C9.55228 1 10 1.44772 10 2V6C10 6.55228 9.55228 7 9 7H8V8C8 8.55228 7.55228 9 7 9H3C2.44772 9 2 8.55228 2 8V4C2 3.44772 2.44772 3 3 3H4V2Z"
                                                stroke="currentColor"
                                                strokeWidth="1.2"
                                                fill="none"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                            <path
                                                d="M4 3H7C7.55228 3 8 3.44772 8 4V7"
                                                stroke="currentColor"
                                                strokeWidth="1.2"
                                                fill="none"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                    </button>
                                </Tooltip>
                                <Tooltip
                                    placement={isSelf ? 'left' : 'right'}
                                    mouseEnterDelay={0.3}
                                    overlay={<span>引用</span>}
                                >
                                    <button
                                        type="button"
                                        className={Style.copyButton}
                                        onClick={() => {
                                            if (type === 'system') return;
                                            const preview =
                                                type === 'text'
                                                    ? content || ''
                                                    : `[${type} 消息]`;
                                            dispatch({
                                                type: ActionTypes.SetStatus,
                                                payload: {
                                                    key: 'quotedMessage',
                                                    value: {
                                                        linkmanId,
                                                        messageId: id,
                                                        username,
                                                        content: preview,
                                                        type,
                                                    },
                                                },
                                            });
                                            MessageToast.success('已引用该条消息');
                                        }}
                                        aria-label="引用"
                                        title="引用"
                                    >
                                        「」
                                    </button>
                                </Tooltip>
                                {(isAdmin || (!client.disableDeleteMessage && isSelf)) && (
                                    <Dropdown
                                        trigger={['click']}
                                        overlay={
                                            <div className={Style.recallDropdown}>
                                                <Menu
                                                    onClick={() => {
                                                        this.handleDeleteMessage();
                                                    }}
                                                    itemIcon={null}
                                                >
                                                    <MenuItem key="recall">撤回消息</MenuItem>
                                                </Menu>
                                            </div>
                                        }
                                        placement={isSelf ? 'bottomRight' : 'bottomLeft'}
                                        getPopupContainer={() => document.body}
                                    >
                                        <div title="更多">
                                            <IconButton
                                                className={Style.button}
                                                icon="omit"
                                                iconSize={12}
                                                width={15}
                                                height={15}
                                            />
                                        </div>
                                    </Dropdown>
                                )}
                            </div>
                        )}
                    </div>
                    {/* <div className={Style.arrow} /> */}
                </div>
            </div>
        );
    }
}

export default connect((state: State) => ({
    isAdmin: !!(state.user && state.user.isAdmin),
}))(Message);
