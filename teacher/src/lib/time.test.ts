import { describe, expect, it } from 'vitest';
import { formatDateTime, formatRelative, formatShort, fromLocalParts, toLocalParts } from './time.js';

describe('Vienna time conversion', () => {
	it('reads summer time (UTC+2)', () => {
		expect(fromLocalParts('2026-10-17', '12:00')).toBe('2026-10-17T10:00:00.000Z');
		expect(toLocalParts('2026-10-17T10:00:00.000Z')).toEqual({ date: '2026-10-17', time: '12:00' });
	});

	it('reads winter time (UTC+1)', () => {
		expect(fromLocalParts('2026-12-01', '09:30')).toBe('2026-12-01T08:30:00.000Z');
		expect(toLocalParts('2026-12-01T08:30:00.000Z')).toEqual({ date: '2026-12-01', time: '09:30' });
	});

	it('defaults the time to 23:59', () => {
		expect(fromLocalParts('2026-11-27', '')).toBe('2026-11-27T22:59:00.000Z');
		expect(fromLocalParts('2026-07-01', '')).toBe('2026-07-01T21:59:00.000Z');
	});

	it('round-trips on both sides of the daylight-saving switches', () => {
		for (const [d, t] of [
			['2026-03-29', '01:59'],
			['2026-03-29', '03:00'],
			['2026-10-25', '01:59'],
			['2026-10-25', '03:00'],
			['2026-12-31', '23:59']
		] as const) {
			expect(toLocalParts(fromLocalParts(d, t))).toEqual({ date: d, time: t });
		}
	});

	it('is a fixed instant regardless of the machine time zone', () => {
		expect(fromLocalParts('2026-07-01', '00:00')).toBe('2026-06-30T22:00:00.000Z');
		// the day the clocks go back: 02:30 exists twice, the first (summer time) one wins or the second; either way it is Vienna 02:30
		const iso = fromLocalParts('2026-10-25', '02:30')!;
		expect(toLocalParts(iso)).toEqual({ date: '2026-10-25', time: '02:30' });
	});

	it('handles empty and invalid input', () => {
		expect(fromLocalParts('', '12:00')).toBeNull();
		expect(fromLocalParts('morgen', '12:00')).toBeNull();
		expect(fromLocalParts('2026-10-17', 'abends')).toBeNull();
		expect(toLocalParts(null)).toEqual({ date: '', time: '' });
	});

	it('formats German date and time', () => {
		expect(formatDateTime('2026-11-13T22:59:00.000Z')).toBe('Fr, 13.11. 23:59');
		expect(formatDateTime(null)).toBe('keine Frist');
		expect(formatShort('2026-11-12T09:42:00.000Z')).toBe('12.11. 10:42');
	});
});

describe('relative activity time', () => {
	// Thursday 2026-11-19 12:00 in Vienna
	const now = new Date('2026-11-19T11:00:00.000Z');

	it('shows today and yesterday with the clock', () => {
		expect(formatRelative('2026-11-19T09:44:00.000Z', now)).toBe('heute 10:44');
		expect(formatRelative('2026-11-18T13:20:00.000Z', now)).toBe('gestern 14:20');
	});

	it('counts calendar days in Vienna, not 24 h blocks', () => {
		// 23:30 Vienna yesterday is only 12.5 h ago but still "gestern"
		expect(formatRelative('2026-11-18T22:30:00.000Z', now)).toBe('gestern 23:30');
		// 00:10 Vienna today
		expect(formatRelative('2026-11-18T23:10:00.000Z', now)).toBe('heute 00:10');
	});

	it('uses "vor N Tagen" up to two weeks, then the date', () => {
		expect(formatRelative('2026-11-16T10:00:00.000Z', now)).toBe('vor 3 Tagen');
		expect(formatRelative('2026-11-06T10:00:00.000Z', now)).toBe('vor 13 Tagen');
		expect(formatRelative('2026-11-05T10:00:00.000Z', now)).toBe('05.11.2026');
	});

	it('marks students who never signed in', () => {
		expect(formatRelative(null, now)).toBe('noch nie angemeldet');
	});

	it('treats a slightly future timestamp (clock skew) as today', () => {
		expect(formatRelative('2026-11-19T11:05:00.000Z', now)).toBe('heute 12:05');
	});
});
