import hljs from 'highlight.js/lib/core';
import java from 'highlight.js/lib/languages/java';

hljs.registerLanguage('java', java);

/** Highlighted HTML for Java source. highlight.js escapes the code, so the result is safe for {@html}. */
export function highlightJava(code: string): string {
	return hljs.highlight(code, { language: 'java', ignoreIllegals: true }).value;
}

/**
 * Splits highlighted HTML into one HTML string per source line. Spans that run over a line break
 * (block comments, text blocks) are closed at the end of the line and reopened on the next one.
 */
export function splitHighlightedLines(html: string): string[] {
	const lines: string[] = [];
	const open: string[] = []; // opening tags of the spans that are currently open
	let cur = '';
	for (const part of html.split(/(<[^>]+>|\n)/)) {
		if (part === '\n') {
			lines.push(cur + '</span>'.repeat(open.length));
			cur = open.join('');
		} else {
			if (part.startsWith('</')) open.pop();
			else if (part.startsWith('<')) open.push(part);
			cur += part;
		}
	}
	lines.push(cur + '</span>'.repeat(open.length));
	return lines;
}
