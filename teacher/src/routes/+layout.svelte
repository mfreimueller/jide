<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href="/icon.svg" type="image/svg+xml" />
	<title>J;DE Lehrkraft</title>
</svelte:head>

{@render children()}
