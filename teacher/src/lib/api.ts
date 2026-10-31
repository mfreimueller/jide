import { goto } from '$app/navigation';
import { auth } from './auth.svelte.js';

const API = import.meta.env.VITE_API_URL ?? '/api';

const NETWORK_MESSAGE = 'Der Server ist nicht erreichbar. Bitte prüfe die Verbindung und versuche es erneut.';
const FALLBACK_MESSAGE = 'Etwas ist schiefgelaufen.';

export class ApiError extends Error {
	constructor(
		public status: number,
		public code: string,
		message: string,
		public data: Record<string, unknown> = {}
	) {
		super(message);
	}
}

interface Options {
	method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	body?: unknown;
	/** Send the session token and sign out on 401. Default true. */
	auth?: boolean;
}

function toError(status: number, data: Record<string, unknown>): ApiError {
	return new ApiError(status, (data.error as string) ?? 'ERROR', (data.message as string) ?? FALLBACK_MESSAGE, data);
}

async function send(path: string, init: RequestInit, useAuth: boolean): Promise<Response> {
	const headers = new Headers(init.headers);
	if (useAuth && auth.token) headers.set('Authorization', `Bearer ${auth.token}`);
	let res: Response;
	try {
		res = await fetch(`${API}${path}`, { ...init, headers });
	} catch {
		throw new ApiError(0, 'NETWORK', NETWORK_MESSAGE);
	}
	if (res.status === 401 && useAuth) {
		auth.clear();
		await goto('/login');
	}
	return res;
}

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
	const { method = 'GET', body, auth: useAuth = true } = opts;
	const headers: Record<string, string> = {};
	if (body !== undefined) headers['Content-Type'] = 'application/json';
	const res = await send(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, useAuth);
	const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
	if (res.ok) return data as T;
	throw toError(res.status, data);
}

/** Uploads a file as the raw request body (the exercise upload is not multipart). */
export async function upload<T = unknown>(path: string, file: Blob, contentType: string): Promise<{ status: number; data: T }> {
	const res = await send(path, { method: 'POST', headers: { 'Content-Type': contentType }, body: file }, true);
	const data = await res.json().catch(() => ({}));
	if (res.ok) return { status: res.status, data: data as T };
	throw toError(res.status, data);
}

/** Fetches a file with the session token and hands it to the browser as a download. */
export async function download(path: string, fallbackName: string): Promise<void> {
	const res = await send(path, {}, true);
	if (!res.ok) throw toError(res.status, await res.json().catch(() => ({})));
	const name = /filename="?([^";]+)"?/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? fallbackName;
	const url = URL.createObjectURL(await res.blob());
	const a = document.createElement('a');
	a.href = url;
	a.download = name;
	a.click();
	URL.revokeObjectURL(url);
}
