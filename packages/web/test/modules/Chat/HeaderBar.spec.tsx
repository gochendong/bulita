/**
 * @jest-environment jsdom
 */

import React from 'react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import HeaderBar from '../../../src/modules/Chat/HeaderBar';

jest.mock('../../../src/hooks/useAction', () => () => ({
    setStatus: jest.fn(),
}));

jest.mock('../../../src/hooks/useIsLogin', () => () => true);

jest.mock('../../../src/hooks/useAero', () => () => ({}));

describe('Chat HeaderBar', () => {
    it('shows self label for self linkman', () => {
        const store = createStore(() => ({
            user: { _id: 'self' },
            connect: true,
            status: {
                sidebarVisible: true,
                functionBarAndLinkmanListVisible: true,
            },
        }));

        render(
            <Provider store={store}>
                <HeaderBar
                    id="selfself"
                    name="我自己"
                    type="friend"
                    tag=""
                    signature=""
                    isOnline
                    onClickFunction={() => {}}
                />
            </Provider>,
        );

        expect(screen.getByText('这是自己')).toBeInTheDocument();
        expect(screen.getByText('个人会话')).toBeInTheDocument();
    });
});
