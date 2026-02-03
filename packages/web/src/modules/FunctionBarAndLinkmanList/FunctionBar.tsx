import React, { useState, useContext, useEffect, useRef } from 'react';

import IconButton from '../../components/IconButton';
import Avatar from '../../components/Avatar';
import CreateGroup from './CreateGroup';
import { ShowUserOrGroupInfoContext } from '../../context';
import { search } from '../../service';

import Style from './FunctionBar.less';
import Input from '../../components/Input';
import Message from '../../components/Message';

type SearchResult = {
    users: any[];
    groups: any[];
};

function FunctionBar() {
    const [keywords, setKeywords] = useState('');
    const [addButtonVisible, toggleAddButtonVisible] = useState(true);
    const [searchResultVisible, toggleSearchResultVisible] = useState(false);
    const [createGroupDialogVisible, toggleCreateGroupDialogVisible] =
        useState(false);
    const [searchResult, setSearchResult] = useState<SearchResult>({
        users: [],
        groups: [],
    });
    const keywordsRef = useRef(keywords);

    const context = useContext(ShowUserOrGroupInfoContext);
    const placeholder = '';

    function resetSearch() {
        toggleSearchResultVisible(false);
        toggleAddButtonVisible(true);
        setSearchResult({ users: [], groups: [] });
        setKeywords('');
        keywordsRef.current = '';
    }

    function handleBodyClick(e: any) {
        if (
            e.target.getAttribute('placeholder') === placeholder ||
            !searchResultVisible
        ) {
            return;
        }

        const { currentTarget } = e;
        let { target } = e;
        do {
            if (target.className.indexOf(Style.searchResult) > -1) {
                return;
            }
            target = target.parentElement;
        } while (target && target !== currentTarget);

        resetSearch();
    }
    useEffect(() => {
        keywordsRef.current = keywords;
    }, [keywords]);

    useEffect(() => {
        document.body.addEventListener('click', handleBodyClick, false);
        return () => {
            document.body.removeEventListener('click', handleBodyClick, false);
        };
    });

    function handleFocus() {
        toggleAddButtonVisible(false);
        toggleSearchResultVisible(true);
    }

    function handleInputEnter() {
        const valueToSearch = keywordsRef.current;
        setTimeout(async () => {
            if (valueToSearch) {
                const result = await search(valueToSearch);
                if (result?.users?.length || result?.groups?.length) {
                    setSearchResult(result);
                } else {
                    Message.warning('没有搜索到内容');
                    setSearchResult({ users: [], groups: [] });
                }
            }
        }, 0);
    }

    function renderSearchUsers(count = 999) {
        const { users } = searchResult;
        count = Math.min(count, users.length);

        function handleClick(targetUser: any) {
            // @ts-ignore
            context.showUserInfo(targetUser);
            resetSearch();
        }

        const usersDom = [];
        for (let i = 0; i < count; i++) {
            usersDom.push(
                <div
                    key={users[i]._id}
                    onClick={() => handleClick(users[i])}
                    role="button"
                >
                    <Avatar size={40} src={users[i].avatar} />
                    <p>{users[i].username}</p>
                </div>,
            );
        }
        return usersDom;
    }

    function renderSearchGroups(count = 999) {
        const { groups } = searchResult;
        count = Math.min(count, groups.length);

        function handleClick(targetGroup: any) {
            // @ts-ignore
            context.showGroupInfo(targetGroup);
            resetSearch();
        }

        const groupsDom = [];
        for (let i = 0; i < count; i++) {
            groupsDom.push(
                <div
                    key={groups[i]._id}
                    onClick={() => handleClick(groups[i])}
                    role="button"
                >
                    <Avatar size={40} src={groups[i].avatar} />
                    <div>
                        <p>{groups[i].name}</p>
                        <p>{groups[i].members}人</p>
                    </div>
                </div>,
            );
        }
        return groupsDom;
    }

    return (
        <div className={Style.functionBar}>
            <span className={Style.searchIcon} title="搜索用户和群组">
                <i className="iconfont icon-search" />
            </span>
            <form
                className={Style.form}
                autoComplete="off"
                onSubmit={(e) => e.preventDefault()}
            >
                <Input
                    className={`${Style.input} ${
                        searchResultVisible ? Style.inputFocus : ''
                    }`}
                    type="text"
                    placeholder={placeholder}
                    value={keywords}
                    onChange={(v) => {
                        keywordsRef.current = v;
                        setKeywords(v);
                    }}
                    onFocus={handleFocus}
                    onBlur={handleInputEnter}
                    onEnter={handleInputEnter}
                />
            </form>
            <button
                type="button"
                className={Style.createGroupButton}
                style={{ display: addButtonVisible ? 'flex' : 'none' }}
                onClick={() => toggleCreateGroupDialogVisible(true)}
                aria-label="创建群组"
                title="创建群组"
            >
                <i className="iconfont icon-add" />
                <span className={Style.createGroupLabel}>建群</span>
            </button>
            <div
                className={Style.searchResult}
                style={{ display: searchResultVisible ? 'block' : 'none' }}
            >
                {searchResult.users.length === 0 &&
                searchResult.groups.length === 0 ? (
                    <p className={Style.none}>没有搜索到内容</p>
                ) : (
                    <div className={Style.allList}>
                        <div
                            style={{
                                display:
                                    searchResult.users.length > 0
                                        ? 'block'
                                        : 'none',
                            }}
                        >
                            <p>用户</p>
                            <div className={Style.userList}>
                                {renderSearchUsers()}
                            </div>
                        </div>
                        <div
                            style={{
                                display:
                                    searchResult.groups.length > 0
                                        ? 'block'
                                        : 'none',
                            }}
                        >
                            <p>群组</p>
                            <div className={Style.groupList}>
                                {renderSearchGroups()}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <CreateGroup
                visible={createGroupDialogVisible}
                onClose={() => toggleCreateGroupDialogVisible(false)}
            />
        </div>
    );
}

// <i className={`iconfont icon-search ${Style.searchIcon}`} />

export default FunctionBar;
