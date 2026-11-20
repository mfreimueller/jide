import { api } from '#lib/api.js';
import { failLoad } from '#lib/errors.js';
import type { ApiKey } from '#lib/types.js';

export async function load({ depends }) {
	depends('app:api-keys');
	try {
		const res = await api<{ apiKeys: ApiKey[] }>('/teacher/api-keys');
		return { apiKeys: res.apiKeys };
	} catch (err) {
		failLoad(err);
	}
}
