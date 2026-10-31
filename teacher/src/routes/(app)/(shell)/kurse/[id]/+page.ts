import { redirect } from '@sveltejs/kit';

export function load({ params }) {
	redirect(307, `/kurse/${params.id}/abgaben`);
}
