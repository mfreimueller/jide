import { api } from '#lib/api.js';
import { failLoad } from '#lib/errors.js';
import type { PracticeHostsResponse } from '@jide/shared';

export async function load({ params }) {
	try {
		const res = await api<PracticeHostsResponse>(`/teacher/courses/${params.id}/practice-hosts`);
		return { hosts: res.hosts };
	} catch (err) {
		failLoad(err);
	}
}
