import React, { useState, useMemo } from 'react';
import { useSelector } from 'react-redux';

import Style from './CreateGroup.less';
import Dialog from '../../components/Dialog';
import Input from '../../components/Input';
import Message from '../../components/Message';
import { createGroup } from '../../service';
import useAction from '../../hooks/useAction';
import { State } from '../../state/reducer';

interface CreateGroupProps {
    visible: boolean;
    onClose: () => void;
}

function CreateGroup(props: CreateGroupProps) {
    const { visible, onClose } = props;
    const action = useAction();
    const [groupName, setGroupName] = useState('');
    const user = useSelector((state: State) => state.user);
    const linkmans = useSelector((state: State) => state.linkmans);
    const maxGroupNum = useSelector((state: State) => state.status.maxGroupNum) ?? 0;
    const createdGroupCount = useMemo(() => {
        if (!user?._id) return 0;
        return Object.values(linkmans).filter(
            (l) => l.type === 'group' && (l as { creator?: string }).creator === user._id,
        ).length;
    }, [user?._id, linkmans]);
    const isAdmin = !!user?.isAdmin;
    const canCreateMore = isAdmin || (maxGroupNum > 0 && createdGroupCount < maxGroupNum);
    const quotaText = isAdmin
        ? `管理员不限制建群数量（已创建 ${createdGroupCount} 个）`
        : maxGroupNum === 0
            ? '当前不允许创建群组'
            : `已创建 ${createdGroupCount} / ${maxGroupNum} 个群组${canCreateMore ? `，还可创建 ${maxGroupNum - createdGroupCount} 个` : '（已达上限）'}`;

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
                <p className={Style.quotaText}>{quotaText}</p>
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
                    disabled={!groupName.trim() || !canCreateMore}
                >
                    创建群组
                </button>
            </div>
        </Dialog>
    );
}

export default CreateGroup;
