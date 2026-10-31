import type { MatrixCell } from './types.js';

export type CellTone = 'ok' | 'part' | 'late' | 'none' | 'plain';

/**
 * Colour of a matrix cell (legend of the design): late wins, then all tests passed (green), some/none passed (yellow).
 * A hand-in without a test summary is not covered by the design legend and shown as neutral "plain".
 */
export function cellTone(cell: MatrixCell | null): CellTone {
	if (!cell) return 'none';
	if (cell.late) return 'late';
	const t = cell.testSummary;
	if (!t || t.total === 0) return 'plain';
	return t.passed >= t.total ? 'ok' : 'part';
}

/** "✓ 4/4", "2/5", "abgegeben" (no tests) — plus " · verspätet". */
export function cellLabel(cell: MatrixCell): string {
	const t = cell.testSummary;
	let text = 'abgegeben';
	if (t && t.total > 0) text = t.passed >= t.total ? `✓ ${t.passed}/${t.total}` : `${t.passed}/${t.total}`;
	return cell.late ? `${text} · verspätet` : text;
}

export const norm = (s: string): string => s.toLocaleLowerCase('de').normalize('NFD').replace(/\p{M}/gu, '');
