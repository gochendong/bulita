import React from 'react';

import expressions from '@bulita/utils/expressions';
import { TRANSPARENT_IMAGE } from '@bulita/utils/const';
import { marked } from 'marked';
import Style from './Message.less';
// import DOMPurify from 'dompurify'

interface TextMessageProps {
    content: string;
}

function TextMessage(props: TextMessageProps) {
    // const reg = /(http:\/\/|https:\/\/|www)(([\w#]|=|\?|\.|\/|&|~|-|[\u200B-\u200D\uFEFF])+)/g;
    // eslint-disable-next-line react/destructuring-assignment
    const content = props.content
        .replace(/<[^>]*?>/gi, '')
        .replace(/(.*?)<\/[^>]*?>/gi, '')
        .replace(/\n/g, '<br>')
        .replace(
            /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}(\.[a-z]{2,6})?\b(:[0-9]{2,5})?([-a-zA-Z0-9@:%_+.~#?&//=]*)/g,
            (r) =>
                `<a class="${Style.selecteAble}" href="${r}" rel="noopener noreferrer" target="_blank">${r}</a>`,
        )
        .replace(/#\(([\u4e00-\u9fa5a-z]+)\)/g, (r, e) => {
            const index = expressions.default.indexOf(e);
            if (index !== -1) {
                return `<img class="${Style.baidu} ${
                    Style.selecteAble
                }" src="${TRANSPARENT_IMAGE}" style="background-position: left ${
                    -30 * index
                }px;" onerror="this.style.display='none'" alt="${r}">`;
            }
            return r;
        });

    return (
        <div
            style={{ wordWrap: 'break-word' }}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: content }}
        />
    );
}

function TextMessageBot(props: TextMessageProps) {
    // const reg = /(http:\/\/|https:\/\/|www)(([\w#]|=|\?|\.|\/|&|~|-|[\u200B-\u200D\uFEFF])+)/g;
    // eslint-disable-next-line react/destructuring-assignment
    let content = marked(props.content);
    content = content
        .replace(
            /<a /g,
            '<a style="color: #1d9cf0;text-decoration: none;" target="_blank" ',
        )
        .replace(
            /<img /g,
            `<img class="${Style.image}" alt="消息图片" width="250" height="250" `,
        );
    content = content.replace(/#\(([\u4e00-\u9fa5a-z]+)\)/g, (r, e) => {
        const index = expressions.default.indexOf(e);
        if (index !== -1) {
            return `<img class="${Style.baidu} ${
                Style.selecteAble
            }" src="${TRANSPARENT_IMAGE}" style="background-position: left ${
                -30 * index
            }px;" onerror="this.style.display='none'" alt="${r}">`;
        }
        return r;
    });
    return (
        <div
            style={{ wordWrap: 'break-word' }}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: content }}
        />
    );
}

export { TextMessage, TextMessageBot };
