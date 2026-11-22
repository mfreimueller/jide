import { describe, expect, it } from 'vitest';
import { checkNewHost, hostFromInput } from './practice_hosts.js';

describe('hostFromInput', () => {
	it('takes the hostname of an http(s) URL', () => {
		expect(hostFromInput('https://die-spengergasse.github.io/practice/aufgabe.zip')).toBe('die-spengergasse.github.io');
		expect(hostFromInput('  HTTP://Example.com:8080/x?y=1 ')).toBe('example.com');
		expect(hostFromInput('https://user:pw@example.com/')).toBe('example.com');
	});
	it('leaves plain text alone (trimmed)', () => {
		expect(hostFromInput('  example.com ')).toBe('example.com');
		expect(hostFromInput('ftp://example.com')).toBe('ftp://example.com');
		expect(hostFromInput('https://')).toBe('https://');
	});
});

describe('checkNewHost', () => {
	it('accepts and normalises a host or URL', () => {
		expect(checkNewHost(' Example.COM ', [])).toEqual({ ok: true, host: 'example.com' });
		expect(checkNewHost('https://a.example.com/p.zip', [])).toEqual({ ok: true, host: 'a.example.com' });
	});
	it('rejects invalid input', () => {
		for (const raw of ['', 'localhost', '192.168.0.1', 'a b.com', 'example.com/x', 'example.com:80', 'ftp://example.com']) {
			expect(checkNewHost(raw, [])).toEqual({ ok: false, error: 'Das ist kein gültiger Hostname.' });
		}
	});
	it('rejects duplicates', () => {
		expect(checkNewHost('HTTPS://example.com/x', ['example.com']).ok).toBe(false);
	});
	it('rejects the 21st host', () => {
		const list = Array.from({ length: 20 }, (_, i) => `h${i}.example.com`);
		expect(checkNewHost('neu.example.com', list).ok).toBe(false);
		expect(checkNewHost('neu.example.com', list.slice(1)).ok).toBe(true);
	});
});
