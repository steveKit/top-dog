<script lang="ts">
	// Inline SVG sigil avatar (TASK-092). Renders one of the five built-in sigils
	// as REAL Svelte SVG markup (no {@html}), keyed by sigil id. Used in the
	// onboarding rite's picker/preview and on the profile page when a member's
	// `avatar_path` is a `sigil:<id>` value (parsed via parseSigilId).
	//
	// The artwork is ported verbatim from src/lib/assets/sigils/*.svg so the
	// rendered faces match the design mockup. Each sigil is a self-contained,
	// circular 100x100 viewBox; `size` controls the rendered px box, `title`
	// supplies an accessible name (omit for a purely decorative instance, which
	// renders aria-hidden).
	import { SIGIL_NAMES, type SigilId } from '$lib/features/profiles/sigils';

	interface Props {
		id: SigilId;
		size?: number;
		title?: string;
	}

	let { id, size = 84, title }: Props = $props();

	const label = $derived(title ?? SIGIL_NAMES[id]);
	const decorative = $derived(title === undefined);
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 100 100"
	width={size}
	height={size}
	class="sigil"
	role={decorative ? undefined : 'img'}
	aria-hidden={decorative ? 'true' : undefined}
	aria-label={decorative ? undefined : label}
>
	{#if !decorative}
		<title>{label}</title>
	{/if}

	{#if id === 'cowled'}
		<circle cx="50" cy="50" r="50" fill="#241a10" />
		<path
			d="M50 18 C34 18 27 33 27 50 C27 70 23 86 21 100 L79 100 C77 86 73 70 73 50 C73 33 66 18 50 18 Z"
			fill="#33261a"
			stroke="#E0A82E"
			stroke-width="1.6"
			stroke-linejoin="round"
		/>
		<ellipse cx="50" cy="48" rx="15" ry="19" fill="#15100a" />
		<rect x="42" y="33" width="16" height="31" rx="8" fill="#CE8F3C" />
		<rect x="44.5" y="36" width="4.5" height="23" rx="2.2" fill="#E0A82E" opacity="0.55" />
		<polyline
			points="46,39 54,45 46,51 54,57"
			fill="none"
			stroke="#F0C23A"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
		<path d="M41 59 q0 6 9 6 q9 0 9 -6 q0 -3 -4 -3 h-10 q-4 0 -4 3 z" fill="#E7C98C" />
	{:else if id === 'haloed'}
		<circle cx="50" cy="50" r="50" fill="#2a1d10" />
		<circle cx="50" cy="40" r="24" fill="#E0A82E" opacity="0.15" />
		<g stroke="#E0A82E" stroke-width="1.7" stroke-linecap="round">
			<line x1="50" y1="19" x2="50" y2="12" />
			<line x1="37" y1="22" x2="33" y2="16" />
			<line x1="63" y1="22" x2="67" y2="16" />
			<line x1="27" y1="30" x2="21" y2="26" />
			<line x1="73" y1="30" x2="79" y2="26" />
		</g>
		<ellipse cx="50" cy="34" rx="20" ry="6" fill="none" stroke="#E0A82E" stroke-width="2.2" />
		<rect x="26" y="49" width="48" height="15" rx="7.5" fill="#CE8F3C" />
		<polyline
			points="32,55 40,51 48,55 56,51 64,55"
			fill="none"
			stroke="#F0C23A"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
		<path d="M22 60 q0 9 28 9 q28 0 28 -9 q0 -4 -6 -4 h-44 q-6 0 -6 4 z" fill="#E7C98C" />
	{:else if id === 'shadowed'}
		<circle cx="50" cy="50" r="50" fill="#1a120b" />
		<path
			d="M50 16 C32 16 25 32 25 50 C25 71 21 87 19 100 L81 100 C79 87 75 71 75 50 C75 32 68 16 50 16 Z"
			fill="#241a11"
			stroke="#caa24a"
			stroke-width="1.4"
			stroke-linejoin="round"
		/>
		<ellipse cx="50" cy="47" rx="14" ry="18" fill="#0d0905" />
		<circle cx="44.5" cy="45" r="3.4" fill="#F0C23A" opacity="0.25" />
		<circle cx="55.5" cy="45" r="3.4" fill="#F0C23A" opacity="0.25" />
		<ellipse cx="44.5" cy="45" rx="2" ry="2.7" fill="#F7D87A" />
		<ellipse cx="55.5" cy="45" rx="2" ry="2.7" fill="#F7D87A" />
		<polyline
			points="44,55 47,57 50,55 53,57 56,55"
			fill="none"
			stroke="#8c6526"
			stroke-width="1.6"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	{:else if id === 'tube'}
		<circle cx="50" cy="50" r="50" fill="#E0A82E" />
		<circle cx="50" cy="50" r="43" fill="none" stroke="#241a10" stroke-width="1.5" opacity="0.35" />
		<ellipse cx="50" cy="30" rx="14" ry="4.5" fill="none" stroke="#241a10" stroke-width="3.4" />
		<rect x="41" y="38" width="18" height="36" rx="9" fill="#241a10" />
		<polyline
			points="45,44 55,52 45,60 55,68"
			fill="none"
			stroke="#E0A82E"
			stroke-width="2.4"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	{:else if id === 'candle'}
		<circle cx="50" cy="50" r="50" fill="#241a10" />
		<circle cx="50" cy="82" r="16" fill="#F0C23A" opacity="0.16" />
		<path
			d="M50 17 C33 17 26 32 26 49 C26 69 22 86 20 100 L80 100 C78 86 74 69 74 49 C74 32 67 17 50 17 Z"
			fill="#33261a"
			stroke="#E0A82E"
			stroke-width="1.6"
			stroke-linejoin="round"
		/>
		<ellipse cx="50" cy="44" rx="13" ry="16" fill="#15100a" />
		<rect x="43" y="31" width="14" height="26" rx="7" fill="#CE8F3C" />
		<polyline
			points="46.5,35 53.5,40 46.5,45 53.5,50"
			fill="none"
			stroke="#F0C23A"
			stroke-width="1.8"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
		<rect x="46.5" y="74" width="7" height="18" rx="1.5" fill="#E7C98C" />
		<path d="M50 66 q5 5 0 9 q-5 -4 0 -9 z" fill="#F0C23A" />
		<circle cx="50" cy="71" r="1.6" fill="#FBF2DF" />
	{/if}
</svg>

<style>
	.sigil {
		display: block;
		border-radius: var(--radius-pill);
	}
</style>
