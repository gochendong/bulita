import React from 'react';

import Dialog from '../../components/Dialog';
import Style from './About.less';
import Common from './Common.less';

interface AboutProps {
    visible: boolean;
    onClose: () => void;
}

function About(props: AboutProps) {
    const { visible, onClose } = props;
    return (
        <Dialog
            className={Style.about}
            visible={visible}
            title="关于"
            onClose={onClose}
        >
            <div>
                <div className={Common.block}>
                    <p className={Common.title}>
                        <a
                            className={Common.href}
                            href="https://nav.bulita.net/"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            🚀 前往导航站
                        </a>
                    </p>
                </div>
                <div className={Common.block}>
                    <a
                        className={Common.href}
                        href="https://docs.bulita.net/doc/1/"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        ❓ 帮助文档
                    </a>
                </div>
                <div className={Common.block2}>
                    <p className={Common.title}>
                        打包方式: {process.env.BUNDLER || 'webpack'}
                    </p>
                </div>
                <div className={Common.block2}>
                    <p>
                        Powered by
                        <a
                            className={Common.href2}
                            href="https://github.com/gochendong/bulita"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            bulita
                        </a>
                    </p>
                </div>
            </div>
        </Dialog>
    );
}

export default About;
