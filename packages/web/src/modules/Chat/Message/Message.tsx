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
        const { isSelf, userId, type, username, avatar } = this.props;
        if (!isSelf && type !== 'system') {
            showUserInfo({
                _id: userId,
                username,
                avatar,
            });
        }
    }

    formatTime() {
        const { time } = this.props;
        const messageTime = new Date(time);
        const nowTime = new Date();
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
        const { isSelf, avatar, tag, tagColorMode, username, type, loading, sendFailed, onRetry, linkmanId, id, isAdmin, senderCreateTime } =
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
                        {tag && <span className={Style.tag}>{tag}</span>}
                        <span className={Style.nickname}>{username}</span>
                        {senderCreateTime && !isSelf && (
                            <UserBadge createTime={senderCreateTime} />
                        )}
                        {process.env.ADMINS.split(',').includes(username) && (
                            <span className={Style.adminTagInMessage}>管理员</span>
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
                                    <div>
                                        <IconButton
                                            className={Style.copyButton}
                                            icon="share"
                                            iconSize={11}
                                            width={15}
                                            height={15}
                                            onClick={this.handleCopyMessage}
                                        />
                                    </div>
                                </Tooltip>
                                {(isAdmin || (!client.disableDeleteMessage && isSelf)) && (
                                    <Tooltip
                                        placement={isSelf ? 'left' : 'right'}
                                        mouseEnterDelay={0.3}
                                        overlay={<span>撤回消息</span>}
                                    >
                                        <div>
                                            <IconButton
                                                className={Style.button}
                                                icon="recall"
                                                iconSize={12}
                                                width={15}
                                                height={15}
                                                onClick={this.handleDeleteMessage}
                                            />
                                        </div>
                                    </Tooltip>
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
