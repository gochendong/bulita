import React, { useState } from 'react';

import Style from './CreateGroup.less';
import Dialog from '../../components/Dialog';
import Input from '../../components/Input';
import Message from '../../components/Message';
import { createGroup } from '../../service';
import useAction from '../../hooks/useAction';

interface CreateGroupProps {
    visible: boolean;
    onClose: () => void;
}

function CreateGroup(props: CreateGroupProps) {
    const { visible, onClose } = props;
    const action = useAction();
    const [groupName, setGroupName] = useState('');

    async function handleCreateGroup() {
        const group = await createGroup(groupName);
        if (group) {
            group.type = 'group';
            action.addLinkman(group, true);
            setGroupName('');
            onClose();
            Message.success('创建群组成功');
        }
    }

    return (
        <Dialog title="新建群组" visible={visible} onClose={onClose}>
            <div className={Style.container}>
                <p className={Style.text}>输入群组名称，创建后即可邀请好友加入</p>
                <Input
                    className={Style.input}
                    value={groupName}
                    onChange={setGroupName}
                    placeholder="群组名称"
                />
                <button
                    className={Style.button}
                    onClick={handleCreateGroup}
                    type="button"
                    disabled={!groupName.trim()}
                >
                    创建群组
                </button>
            </div>
        </Dialog>
    );
}

export default CreateGroup;
