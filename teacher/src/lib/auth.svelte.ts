const KEY = 'jide.teacher.session';

export interface Teacher {
	id: number;
	email: string;
	displayName: string;
}

interface Stored {
	token: string;
	expiresAt: string;
	teacher: Teacher;
}

class Auth {
	token = $state<string | null>(null);
	teacher = $state<Teacher | null>(null);

	constructor() {
		if (typeof localStorage === 'undefined') return;
		try {
			const raw = localStorage.getItem(KEY);
			if (!raw) return;
			const s = JSON.parse(raw) as Stored;
			if (new Date(s.expiresAt) > new Date()) {
				this.token = s.token;
				this.teacher = s.teacher;
			} else {
				localStorage.removeItem(KEY);
			}
		} catch {
			// Storage blocked or corrupted: behave as signed out.
		}
	}

	get signedIn(): boolean {
		return this.token !== null;
	}

	set(s: Stored): void {
		this.token = s.token;
		this.teacher = s.teacher;
		try {
			localStorage.setItem(KEY, JSON.stringify(s));
		} catch {
			// Session lasts until reload only.
		}
	}

	clear(): void {
		this.token = null;
		this.teacher = null;
		try {
			localStorage.removeItem(KEY);
		} catch {
			// ignore
		}
	}
}

export const auth = new Auth();
