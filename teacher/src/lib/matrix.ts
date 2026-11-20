import type { GradeSymbol, MatrixCell, MatrixExercise } from './types.js';

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

// ---- grades ----

const SYMBOLS: Record<GradeSymbol, { text: string; name: string; tone: 'good' | 'mid' | 'bad' }> = {
	PLUS: { text: '+', name: 'Plus', tone: 'good' },
	PLUS_WELLE: { text: '+~', name: 'Plus-Welle', tone: 'good' },
	WELLE: { text: '~', name: 'Welle', tone: 'mid' },
	MINUS_WELLE: { text: '\u2212~', name: 'Minus-Welle', tone: 'bad' },
	MINUS: { text: '\u2212', name: 'Minus', tone: 'bad' }
};

/** "+", "+~", "~", "−~", "−" (U+2212). */
export const symbolText = (s: GradeSymbol): string => SYMBOLS[s].text;
/** "Plus", "Plus-Welle", "Welle", "Minus-Welle", "Minus". */
export const symbolName = (s: GradeSymbol): string => SYMBOLS[s].name;
/** + and +~ green, ~ amber, −~ and − red. */
export const symbolTone = (s: GradeSymbol): 'good' | 'mid' | 'bad' => SYMBOLS[s].tone;

/** "2 Zeilenkommentare im Code." / "1 Zeilenkommentar im Code." / "" for none. */
export function lineCommentsText(n: number): string {
	if (n <= 0) return '';
	return n === 1 ? '1 Zeilenkommentar im Code.' : `${n} Zeilenkommentare im Code.`;
}

// ---- hiding exercise columns ----

export type HiddenReason = 'beurteilt' | 'von Hand';

/** Why the column is hidden, or null if it is visible. Override wins; otherwise graded + switch on. */
export function hiddenReason(ex: Pick<MatrixExercise, 'visibility' | 'gradedCount'>, hideGraded: boolean): HiddenReason | null {
	if (ex.visibility === 'hidden') return 'von Hand';
	if (ex.visibility === 'shown') return null;
	return hideGraded && ex.gradedCount > 0 ? 'beurteilt' : null;
}

/** Newest unlock first, never-dated last, then title. */
export function newestFirst<T extends Pick<MatrixExercise, 'unlockedAt' | 'title'>>(list: T[]): T[] {
	return [...list].sort((a, b) => {
		if (a.unlockedAt !== b.unlockedAt) {
			if (a.unlockedAt === null) return 1;
			if (b.unlockedAt === null) return -1;
			return a.unlockedAt < b.unlockedAt ? 1 : -1;
		}
		return a.title.localeCompare(b.title, 'de');
	});
}

/** Hidden exercises with their reason, newest first. */
export function hiddenList<T extends MatrixExercise>(exercises: T[], hideGraded: boolean): { ex: T; reason: HiddenReason }[] {
	const out: { ex: T; reason: HiddenReason }[] = [];
	for (const ex of newestFirst(exercises)) {
		const reason = hiddenReason(ex, hideGraded);
		if (reason) out.push({ ex, reason });
	}
	return out;
}

/** "Titel · beurteilt" */
export const chipLabel = (title: string, reason: HiddenReason): string => `${title} · ${reason}`;

/** "+K weitere" count beyond the 3 chips; 0 when nothing more. */
export const moreCount = (hiddenTotal: number, chips = 3): number => Math.max(0, hiddenTotal - chips);

/** "N ausgeblendet · neueste zuerst" */
export const popoverCaption = (n: number): string => `${n} ausgeblendet · neueste zuerst`;

/** "16 / 16" or "16 / 16 · 🔒 12" */
export const handInsText = (done: number, total: number, graded: number): string =>
	graded > 0 ? `${done} / ${total} · \u{1F512} ${graded}` : `${done} / ${total}`;
