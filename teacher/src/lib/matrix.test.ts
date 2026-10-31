import { describe, expect, it } from 'vitest';
import { cellLabel, cellTone, norm } from './matrix.js';
import type { MatrixCell } from './types.js';

const cell = (over: Partial<MatrixCell>): MatrixCell => ({
	handinId: 1,
	submittedAt: '2026-11-20T10:00:00.000Z',
	late: false,
	testSummary: { passed: 4, total: 4 },
	count: 1,
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
