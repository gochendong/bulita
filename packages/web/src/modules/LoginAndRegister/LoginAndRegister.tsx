import React from 'react';
import { useSelector } from 'react-redux';

import {
    Tabs,
    TabPane,
    TabContent,
    ScrollableInkTabBar,
} from '../../components/Tabs';
import Style from './LoginAndRegister.less';
import Login from './Login';
import Register from './Register';
import Dialog from '../../components/Dialog';
import { State } from '../../state/reducer';
import useAction from '../../hooks/useAction';

function LoginAndRegister() {
    const action = useAction();
    const loginRegisterDialogVisible = useSelector(
        (state: State) => state.status.loginRegisterDialogVisible,
    );

    return (
        <Dialog
            visible={loginRegisterDialogVisible}
            closable={false}
            onClose={() => action.toggleLoginRegisterDialog(false)}
        >
            <Tabs
                className={Style.login}
                defaultActiveKey="register"
                renderTabBar={() => <ScrollableInkTabBar />}
                renderTabContent={() => <TabContent />}
            >
                <TabPane tab="游客" key="register">
                    <Register />
                </TabPane>
                <TabPane tab="登录" key="login">
                    <Login />
                </TabPane>
            </Tabs>
        </Dialog>
    );
}

export default LoginAndRegister;
