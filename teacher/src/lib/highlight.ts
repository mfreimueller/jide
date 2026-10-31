import hljs from 'highlight.js/lib/core';
import java from 'highlight.js/lib/languages/java';

hljs.registerLanguage('java', java);

/** Highlighted HTML for Java source. highlight.js escapes the code, so the result is safe for {@html}. */
export function highlightJava(code: string): string {
	return hljs.highlight(code, { language: 'java', ignoreIllegals: true }).value;
}
