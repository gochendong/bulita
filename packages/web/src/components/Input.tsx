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
    onBlur?: () => void;
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
        onBlur = () => {},
    } = props;

    const $input = useRef(null);
    const [focused, setFocused] = useState(false);

    function handleInput(e: any) {
        onChange(e.target.value);
    }

    function handleKeyDown(e: any) {
        if (e.key === 'Enter') {
            onEnter(value as string);
        }
    }

    function handleClickClear(e?: React.MouseEvent) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        onChange('');
        // @ts-ignore
        if ($input.current) {
            $input.current.focus();
        }
    }

    function handleFocus(e: any) {
        setFocused(true);
        onFocus();
    }

    function handleBlur(e: any) {
        setFocused(false);
        onBlur();
    }

    return (
        <div
            className={`${Style.inputContainer} ${className}`}
            data-has-value={!!(value && value.toString().trim())}
        >
            <input
                className={Style.input}
                type={type}
                value={value}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                onFocus={handleFocus}
                onBlur={handleBlur}
                ref={$input}
                placeholder={placeholder}
                autoComplete={autoComplete}
            />
            {value && showClearBtn && focused && (
                <IconButton
                    className={Style.inputIconButton}
                    width={32}
                    height={32}
                    iconSize={18}
                    icon="clear"
                    onMouseDown={(e) => handleClickClear(e)}
                />
            )}
        </div>
    );
}

export default Input;
