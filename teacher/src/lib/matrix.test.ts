import { describe, expect, it } from 'vitest';
import {
	cellLabel,
	cellTone,
	chipLabel,
	handInsText,
	hiddenList,
	hiddenReason,
	lineCommentsText,
	moreCount,
	newestFirst,
	norm,
	popoverCaption,
	symbolName,
	symbolText,
	symbolTone
} from './matrix.js';
import type { MatrixCell, MatrixExercise } from './types.js';

const cell = (over: Partial<MatrixCell>): MatrixCell => ({
	handinId: 1,
	submittedAt: '2026-11-20T10:00:00.000Z',
	late: false,
	testSummary: { passed: 4, total: 4 },
	count: 1,
	grade: null,
	...over
});

describe('matrix cells', () => {
	it('colours by legend', () => {
		expect(cellTone(null)).toBe('none');
		expect(cellTone(cell({}))).toBe('ok');
		expect(cellTone(cell({ testSummary: { passed: 2, total: 5 } }))).toBe('part');
		expect(cellTone(cell({ testSummary: { passed: 0, total: 5 } }))).toBe('part');
		expect(cellTone(cell({ late: true }))).toBe('late');
		expect(cellTone(cell({ testSummary: null }))).toBe('plain');
	});

	it('labels', () => {
		expect(cellLabel(cell({}))).toBe('✓ 4/4');
		expect(cellLabel(cell({ testSummary: { passed: 2, total: 5 }, late: true }))).toBe('2/5 · verspätet');
		expect(cellLabel(cell({ testSummary: null }))).toBe('abgegeben');
	});

	it('search ignores case and accents', () => {
		expect(norm('Müller')).toContain(norm('muller'));
		expect(norm('ANNA')).toBe('anna');
	});
});

const ex = (over: Partial<MatrixExercise>): MatrixExercise => ({
	id: 'a',
	title: 'A',
	deadline: null,
	gradedCount: 0,
	visibility: null,
	unlockedAt: '2026-11-01T10:00:00.000Z',
	...over
});

describe('grade symbols', () => {
	it('text, name and tone', () => {
		expect(symbolText('MINUS_WELLE')).toBe('\u2212~');
		expect(symbolText('MINUS')).toBe('\u2212');
		expect(symbolText('PLUS_WELLE')).toBe('+~');
		expect(symbolName('MINUS_WELLE')).toBe('Minus-Welle');
		expect(symbolName('PLUS_WELLE')).toBe('Plus-Welle');
		expect(['PLUS', 'PLUS_WELLE', 'WELLE', 'MINUS_WELLE', 'MINUS'].map((s) => symbolTone(s as never))).toEqual([
			'good',
			'good',
			'mid',
			'bad',
			'bad'
		]);
	});

	it('line comment counts', () => {
		expect(lineCommentsText(0)).toBe('');
		expect(lineCommentsText(1)).toBe('1 Zeilenkommentar im Code.');
		expect(lineCommentsText(2)).toBe('2 Zeilenkommentare im Code.');
	});

	it('hand-ins text', () => {
		expect(handInsText(16, 16, 0)).toBe('16 / 16');
		expect(handInsText(16, 16, 12)).toBe('16 / 16 \u00b7 \u{1F512} 12');
	});
});

describe('hiding columns', () => {
	it('effective visibility: override wins, else graded + switch', () => {
		expect(hiddenReason(ex({ gradedCount: 2 }), true)).toBe('beurteilt');
		expect(hiddenReason(ex({ gradedCount: 2 }), false)).toBeNull();
		expect(hiddenReason(ex({ gradedCount: 0 }), true)).toBeNull();
		expect(hiddenReason(ex({ visibility: 'hidden' }), false)).toBe('von Hand');
		expect(hiddenReason(ex({ visibility: 'hidden', gradedCount: 3 }), true)).toBe('von Hand');
		expect(hiddenReason(ex({ visibility: 'shown', gradedCount: 3 }), true)).toBeNull();
	});

	it('newest unlock first, undated last, then title', () => {
		const list = [
			ex({ id: '1', title: 'B', unlockedAt: '2026-11-01T00:00:00Z' }),
			ex({ id: '2', title: 'Z', unlockedAt: null }),
			ex({ id: '3', title: 'A', unlockedAt: '2026-11-05T00:00:00Z' }),
			ex({ id: '4', title: 'A2', unlockedAt: '2026-11-01T00:00:00Z' }),
			ex({ id: '5', title: 'C', unlockedAt: null })
		];
		expect(newestFirst(list).map((e) => e.id)).toEqual(['3', '4', '1', '5', '2']);
	});

	it('hiddenList only has hidden ones with reasons', () => {
		const list = [
			ex({ id: '1', gradedCount: 1, unlockedAt: '2026-11-01T00:00:00Z' }),
			ex({ id: '2' }),
			ex({ id: '3', visibility: 'hidden', unlockedAt: '2026-11-09T00:00:00Z' }),
			ex({ id: '4', gradedCount: 5, visibility: 'shown' })
		];
		expect(hiddenList(list, true).map((h) => [h.ex.id, h.reason])).toEqual([
			['3', 'von Hand'],
			['1', 'beurteilt']
		]);
		expect(hiddenList(list, false).map((h) => h.ex.id)).toEqual(['3']);
	});

	it('labels', () => {
		expect(chipLabel('12 Methoden', 'beurteilt')).toBe('12 Methoden \u00b7 beurteilt');
		expect(chipLabel('10 W\u00fcrfel', 'von Hand')).toBe('10 W\u00fcrfel \u00b7 von Hand');
		expect(moreCount(2)).toBe(0);
		expect(moreCount(3)).toBe(0);
		expect(moreCount(20)).toBe(17);
		expect(popoverCaption(20)).toBe('20 ausgeblendet \u00b7 neueste zuerst');
	});
});
