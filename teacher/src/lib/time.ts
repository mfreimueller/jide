// Teachers think in school time. The server stores UTC; these helpers convert at the edge.
export const SCHOOL_TZ = 'Europe/Vienna';
export const DEFAULT_DEADLINE_TIME = '23:59';

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

interface Parts {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
}

function parts(date: Date, timeZone: string): Parts {
	const fmt = new Intl.DateTimeFormat('en-GB', {
		timeZone,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit'
	});
	const out: Record<string, number> = {};
	for (const p of fmt.formatToParts(date)) if (p.type !== 'literal') out[p.type] = Number(p.value);
	return out as unknown as Parts;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO instant -> date and time as shown on a Vienna clock: `{ date: "2026-10-17", time: "12:00" }`. */
export function toLocalParts(iso: string | null, timeZone = SCHOOL_TZ): { date: string; time: string } {
	if (!iso) return { date: '', time: '' };
	const p = parts(new Date(iso), timeZone);
	return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}` };
}

/**
 * Date ("2026-10-17") and time ("12:00") read as Vienna wall-clock time -> ISO instant.
 * An empty time falls back to 23:59. Returns null for an empty or invalid date.
 */
export function fromLocalParts(date: string, time: string, timeZone = SCHOOL_TZ): string | null {
	const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
	const t = /^(\d{2}):(\d{2})$/.exec(time || DEFAULT_DEADLINE_TIME);
	if (!d || !t) return null;
	const [y, mo, day] = [Number(d[1]), Number(d[2]), Number(d[3])];
	const [h, mi] = [Number(t[1]), Number(t[2])];
	const wanted = Date.UTC(y, mo - 1, day, h, mi);
	// Pretend the wall time is UTC, then correct by the zone's offset at that moment.
	// Two passes settle correctly around daylight-saving changes.
	let guess = wanted;
	for (let i = 0; i < 2; i++) {
		const p = parts(new Date(guess), timeZone);
		guess -= Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - wanted;
	}
	return new Date(guess).toISOString();
}

function weekday(p: Parts): string {
	return WEEKDAYS[new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()]!;
}

/** "Fr, 13.11. 23:59" */
export function formatDateTime(iso: string | null, timeZone = SCHOOL_TZ): string {
	if (!iso) return 'keine Frist';
	const p = parts(new Date(iso), timeZone);
	return `${weekday(p)}, ${pad(p.day)}.${pad(p.month)}. ${pad(p.hour)}:${pad(p.minute)}`;
}

/** "13.11." */
export function formatDay(iso: string | null, timeZone = SCHOOL_TZ): string {
	if (!iso) return '';
	const p = parts(new Date(iso), timeZone);
	return `${pad(p.day)}.${pad(p.month)}.`;
}

/** "12.11. 10:42" */
export function formatShort(iso: string | null, timeZone = SCHOOL_TZ): string {
	if (!iso) return '';
	const p = parts(new Date(iso), timeZone);
	return `${pad(p.day)}.${pad(p.month)}. ${pad(p.hour)}:${pad(p.minute)}`;
}

/** Whole calendar days between two instants on a Vienna calendar (later - earlier). */
function calendarDays(from: Parts, to: Parts): number {
	return Math.round((Date.UTC(to.year, to.month - 1, to.day) - Date.UTC(from.year, from.month - 1, from.day)) / 86_400_000);
}

/**
 * "Zuletzt aktiv": "heute 10:44", "gestern 14:20", "vor 3 Tagen", from 14 days on the date ("03.10.2026").
 * Counted in calendar days on the Vienna clock.
 */
export function formatRelative(iso: string | null, now: Date = new Date(), timeZone = SCHOOL_TZ): string {
	if (!iso) return 'noch nie angemeldet';
	const then = parts(new Date(iso), timeZone);
	const days = calendarDays(then, parts(now, timeZone));
	const clock = `${pad(then.hour)}:${pad(then.minute)}`;
	if (days <= 0) return `heute ${clock}`;
	if (days === 1) return `gestern ${clock}`;
	if (days < 14) return `vor ${days} Tagen`;
	return `${pad(then.day)}.${pad(then.month)}.${then.year}`;
}
