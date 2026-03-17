import React, { useEffect, useRef, useState } from 'react';
import Loading from 'react-loading';

import expressions from '@bulita/utils/expressions';
import { addParam } from '@bulita/utils/url';
import BaiduImage from '@bulita/assets/images/baidu.png';
import Style from './Expression.less';
import Input from '../../components/Input';
import { searchExpression } from '../../service';

interface ExpressionProps {
    onSelectText: (expression: string) => void;
    onSelectImage: (expression: string) => void;
}

function Expression(props: ExpressionProps) {
    const { onSelectText, onSelectImage } = props;

    const [activeTab, setActiveTab] = useState<'default' | 'search'>('default');
    const [keywords, setKeywords] = useState('');
    const [searchLoading, toggleSearchLoading] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const searchTimerRef = useRef<number | null>(null);
    const keywordsRef = useRef(keywords);

    useEffect(() => {
        keywordsRef.current = keywords;
    }, [keywords]);

    async function handleSearchExpression() {
        const valueToSearch = keywords.trim();
        if (!valueToSearch) {
            setSearchResults([]);
            toggleSearchLoading(false);
            return;
        }
        toggleSearchLoading(true);
        setSearchResults([]);
        const result = await searchExpression(valueToSearch);
        setSearchResults(result || []);
        toggleSearchLoading(false);
    }

    async function handleSearchExpressionNow(value: string) {
        if (searchTimerRef.current) {
            clearTimeout(searchTimerRef.current);
            searchTimerRef.current = null;
        }
        const nextValue = value.trim();
        keywordsRef.current = value;
        setKeywords(value);
        if (activeTab !== 'search') {
            setActiveTab('search');
        }
        if (!nextValue) {
            setSearchResults([]);
            toggleSearchLoading(false);
            return;
        }
        toggleSearchLoading(true);
        setSearchResults([]);
        const result = await searchExpression(nextValue);
        if (keywordsRef.current.trim() !== nextValue) {
            return;
        }
        setSearchResults(result || []);
        toggleSearchLoading(false);
    }

    useEffect(() => {
        if (activeTab !== 'search') {
            return undefined;
        }

        if (searchTimerRef.current) {
            clearTimeout(searchTimerRef.current);
        }

        if (!keywords.trim()) {
            setSearchResults([]);
            toggleSearchLoading(false);
            return undefined;
        }

        searchTimerRef.current = window.setTimeout(() => {
            handleSearchExpression();
        }, 1000);

        return () => {
            if (searchTimerRef.current) {
                clearTimeout(searchTimerRef.current);
            }
        };
    }, [activeTab, keywords]);

    const renderDefaultExpression = (
        <div className={Style.defaultExpression}>
            {expressions.default.map((e, index) => (
                <div
                    className={Style.defaultExpressionBlock}
                    key={e}
                    data-name={e}
                    onClick={(event) =>
                        onSelectText(event.currentTarget.dataset.name as string)
                    }
                    role="button"
                >
                    <div
                        className={Style.defaultExpressionItem}
                        style={{
                            backgroundPosition: `left ${-30 * index}px`,
                            backgroundImage: `url(${BaiduImage})`,
                        }}
                    />
                </div>
            ))}
        </div>
    );

    function handleClickExpression(e: any) {
        const $target = e.target;
        const url = addParam($target.src, {
            width: $target.naturalWidth,
            height: $target.naturalHeight,
        });
        onSelectImage(url);
    }

    const renderSearchExpression = (
            <div className={Style.searchExpression}>
                <div className={Style.searchExpressionInputBlock}>
                    <Input
                        className={Style.searchExpressionInput}
                        value={keywords}
                        onChange={setKeywords}
                        inputMode="search"
                        enterKeyHint="search"
                        onEnter={handleSearchExpressionNow}
                    />
                </div>
            <div
                className={`${Style.loading} ${
                    searchLoading ? 'show' : 'hide'
                }`}
            >
                <Loading
                    type="spinningBubbles"
                    color="#4A90E2"
                    height={100}
                    width={100}
                />
            </div>
            <div className={Style.searchResult}>
                {searchResults.map(({ image }) => (
                    <div className={Style.searchImage}>
                        <img
                            src={image}
                            alt="表情"
                            key={image}
                            onClick={handleClickExpression}
                        />
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className={Style.expression}>
            <div className={Style.tabHeader}>
                <button
                    type="button"
                    className={`${Style.tabButton} ${
                        activeTab === 'default' ? Style.tabButtonActive : ''
                    }`}
                    onClick={() => setActiveTab('default')}
                >
                    默认表情
                </button>
                <button
                    type="button"
                    className={`${Style.tabButton} ${
                        activeTab === 'search' ? Style.tabButtonActive : ''
                    }`}
                    onClick={() => setActiveTab('search')}
                >
                    搜索表情包
                </button>
            </div>
            <div className={Style.tabPanel}>
                {activeTab === 'default'
                    ? renderDefaultExpression
                    : renderSearchExpression}
            </div>
        </div>
    );
}

export default Expression;
