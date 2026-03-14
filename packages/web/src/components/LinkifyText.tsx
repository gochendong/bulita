import React from 'react';

interface LinkifyTextProps {
    text: string;
    className?: string;
    linkClassName?: string;
    stopPropagation?: boolean;
}

const URL_REGEXP = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;

function normalizeHref(url: string) {
    if (/^https?:\/\//i.test(url)) {
        return url;
    }
    return `https://${url}`;
}

function renderLine(
    line: string,
    lineIndex: number,
    linkClassName?: string,
    stopPropagation?: boolean,
) {
    const matches = Array.from(line.matchAll(URL_REGEXP));
    if (matches.length === 0) {
        return line;
    }

    const nodes: React.ReactNode[] = [];
    let cursor = 0;

    matches.forEach((match, index) => {
        const url = match[0];
        const start = match.index ?? 0;

        if (start > cursor) {
            nodes.push(line.slice(cursor, start));
        }

        nodes.push(
            <a
                key={`link-${lineIndex}-${index}`}
                className={linkClassName}
                href={normalizeHref(url)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={
                    stopPropagation
                        ? (event) => event.stopPropagation()
                        : undefined
                }
            >
                {url}
            </a>,
        );

        cursor = start + url.length;
    });

    if (cursor < line.length) {
        nodes.push(line.slice(cursor));
    }

    return nodes;
}

function LinkifyText(props: LinkifyTextProps) {
    const {
        text,
        className,
        linkClassName,
        stopPropagation = false,
    } = props;
    const lines = text.split('\n');

    return (
        <span className={className}>
            {lines.map((line, index) => (
                <React.Fragment key={`line-${index}`}>
                    {renderLine(line, index, linkClassName, stopPropagation)}
                    {index < lines.length - 1 ? <br /> : null}
                </React.Fragment>
            ))}
        </span>
    );
}

export default LinkifyText;
