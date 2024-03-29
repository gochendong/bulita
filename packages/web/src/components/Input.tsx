import React, { useRef, useState, useEffect } from 'react';

import IconButton from './IconButton';
import Style from './Input.less';

interface InputProps {
    value?: string;
    type?: string;
    placeholder?: string;
    className?: string;
    autoComplete?: string;
    showClearBtn?: boolean;
    onChange: (value: string) => void;
    onEnter?: (value: string) => void;
    onFocus?: () => void;
}

function Input(props: InputProps) {
    const {
        value,
        type = 'text',
        placeholder = '',
        className = '',
        autoComplete = 'off',
        showClearBtn = true,
        onChange,
        onEnter = () => {},
        onFocus = () => {},
    } = props;

    const $input = useRef(null);

    function handleInput(e: any) {
        onChange(e.target.value);
    }

    function handleKeyDown(e: any) {
        if (e.key === 'Enter') {
            onEnter(value as string);
        }
    }

    function handleClickClear() {
        onChange('');
        // @ts-ignore
        $input.current.focus();
    }

    return (
        <div className={`${Style.inputContainer} ${className}`}>
            <input
                className={Style.input}
                type={type}
                value={value}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                onFocus={onFocus}
                ref={$input}
                placeholder={placeholder}
                autoComplete={autoComplete}
            />
            {value && showClearBtn && (
                <IconButton
                    className={Style.inputIconButton}
                    width={32}
                    height={32}
                    iconSize={18}
                    icon="clear"
                    onClick={handleClickClear}
                />
            )}
        </div>
    );
}

export default Input;
