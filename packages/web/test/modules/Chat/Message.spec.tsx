/**
 * @jest-environment jsdom
 */

import React, { createRef } from 'react';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import { Message } from '../../../src/modules/Chat/Message/Message';

describe('Chat Message actions', () => {
    beforeEach(() => {
        Element.prototype.scrollIntoView = jest.fn();
    });

    function renderMessage(overrideProps = {}) {
        const ref = createRef<Message>();

        render(
            <Message
                ref={ref}
                id="message-1"
                linkmanId="linkman-1"
                isSelf
                userId="user-1"
                avatar=""
                username="tester"
                originUsername="tester"
                tag=""
                time="2025-03-17T12:00:00.000Z"
                type="text"
                content="hello"
                loading={false}
                percent={0}
                shouldScroll={false}
                tagColorMode="singleColor"
                isAdmin={false}
                linkmanType="friend"
                isBotConversation={false}
                isSelfConversation={false}
                {...overrideProps}
            />,
        );

        act(() => {
            ref.current?.setState({ showButtonList: true });
        });
    }

    it('shows quote only in group conversations', () => {
        renderMessage({ linkmanType: 'group' });

        expect(screen.getByLabelText('复制')).toBeInTheDocument();
        expect(screen.getByLabelText('引用')).toBeInTheDocument();
        expect(screen.getByLabelText('更多')).toBeInTheDocument();
    });

    it('shows only copy and recall in normal private conversations', () => {
        renderMessage({ linkmanType: 'friend' });

        expect(screen.getByLabelText('复制')).toBeInTheDocument();
        expect(screen.queryByLabelText('引用')).not.toBeInTheDocument();
        expect(screen.getByLabelText('更多')).toBeInTheDocument();
    });

    it('shows only copy in AI conversations', () => {
        renderMessage({
            linkmanType: 'friend',
            isBotConversation: true,
        });

        expect(screen.getByLabelText('复制')).toBeInTheDocument();
        expect(screen.queryByLabelText('引用')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('更多')).not.toBeInTheDocument();
    });

    it('shows copy and recall in self conversations', () => {
        renderMessage({
            linkmanType: 'friend',
            isSelfConversation: true,
        });

        expect(screen.getByLabelText('复制')).toBeInTheDocument();
        expect(screen.queryByLabelText('引用')).not.toBeInTheDocument();
        expect(screen.getByLabelText('更多')).toBeInTheDocument();
    });
});
