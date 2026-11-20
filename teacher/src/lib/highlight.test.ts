import { describe, expect, it } from 'vitest';
import { highlightJava, splitHighlightedLines } from './highlight.js';

describe('splitHighlightedLines', () => {
	it('gives one entry per line', () => {
		expect(splitHighlightedLines('a\nb\nc')).toEqual(['a', 'b', 'c']);
	});

	it('closes and reopens spans that cross a line break', () => {
		expect(splitHighlightedLines('<span class="x">a\nb</span>\nc')).toEqual([
			'<span class="x">a</span>',
			'<span class="x">b</span>',
			'c'
		]);
	});

	it('matches the number of source lines for real Java', () => {
		const src = '/* one\n two */\nclass A {\n  String s = "x";\n}';
		expect(splitHighlightedLines(highlightJava(src))).toHaveLength(5);
	});
});
