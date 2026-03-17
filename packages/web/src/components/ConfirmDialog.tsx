import React from 'react';

import Dialog from './Dialog';
import Button from './Button';
import Style from './ConfirmDialog.less';

interface ConfirmDialogProps {
    visible: boolean;
    title: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    confirmType?: string;
    onConfirm: () => void;
    onClose: () => void;
}

function ConfirmDialog(props: ConfirmDialogProps) {
    const {
        visible,
        title,
        description = '',
        confirmText = '确认',
        cancelText = '取消',
        confirmType = 'danger',
        onConfirm,
        onClose,
    } = props;

    return (
        <Dialog
            className={Style.confirmDialog}
            title={title}
            visible={visible}
            onClose={onClose}
        >
            {description ? (
                <p className={Style.description}>{description}</p>
            ) : null}
            <div className={Style.actions}>
                <Button className={Style.actionButton} onClick={onClose}>
                    {cancelText}
                </Button>
                <Button
                    className={Style.actionButton}
                    type={confirmType}
                    onClick={onConfirm}
                >
                    {confirmText}
                </Button>
            </div>
        </Dialog>
    );
}

export default ConfirmDialog;
