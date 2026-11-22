import { MAX_PRACTICE_HOSTS, normalisePracticeHost } from '@jide/shared/practice-hosts'; // subpath: the package index pulls in node:fs, which the browser cannot load

/** A pasted http(s) URL is reduced to its host name; anything else is returned trimmed. */
export function hostFromInput(raw: string): string {
	const text = raw.trim();
	if (/^https?:\/\//i.test(text)) {
		try {
			return new URL(text).hostname;
		} catch {
			return text;
		}
	}
	return text;
}

export type HostCheck = { ok: true; host: string } | { ok: false; error: string };

/** Validates the text of the input field against the current list before anything is sent. */
export function checkNewHost(raw: string, existing: readonly string[]): HostCheck {
	const host = normalisePracticeHost(hostFromInput(raw));
	if (host === null) return { ok: false, error: 'Das ist kein gültiger Hostname.' };
	if (existing.includes(host)) return { ok: false, error: `${host} steht schon in der Liste.` };
	if (existing.length >= MAX_PRACTICE_HOSTS) return { ok: false, error: `Es sind höchstens ${MAX_PRACTICE_HOSTS} Hosts pro Kurs möglich.` };
	return { ok: true, host };
}
