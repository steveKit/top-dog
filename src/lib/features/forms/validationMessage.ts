// Top Dog M8 themed form validation — PURE module. No DOM / Svelte / SvelteKit
// imports so the failure -> cult-message mapping is fully unit-testable in
// isolation (CLAUDE.md Testing Strategy: pure logic is TDD-first, lives in a
// plain .ts with a co-located *.test.ts).
//
// This is the message layer ONLY. It maps a field's human label + which native
// Constraint Validation constraint failed (taken from an <input>'s ValidityState)
// to a themed, field-naming error string in the cult voice. The DOM-touching
// integration (reading input.validity, setting aria-* attrs, focusing) lives in
// the reusable `formValidation` action, which calls into here — keeping the
// string logic free of the browser so it can be tested under Node/Vitest.
//
// We deliberately do NOT use the browser's input.validationMessage (the source of
// the native bubble copy) — we author our own themed copy here instead.

// The subset of HTML constraint-validation failures the gate forms can produce.
// Mirrors the boolean flags on the native ValidityState, narrowed to what our
// required email / password / token / code fields actually trip.
export type FieldFailure =
	| 'valueMissing' // required field left empty
	| 'typeMismatch' // type="email" with malformed value
	| 'tooShort' // minlength not met
	| 'patternMismatch' // pattern= not matched
	| 'tooLong' // maxlength exceeded (rare; included for completeness)
	| 'other'; // any other constraint — generic themed fallback

// The minimal shape we read from a native ValidityState. Accepting this structural
// type (rather than the DOM lib's ValidityState) keeps the module importable and
// testable without a DOM environment.
export interface ValidityFlags {
	valueMissing?: boolean;
	typeMismatch?: boolean;
	tooShort?: boolean;
	patternMismatch?: boolean;
	tooLong?: boolean;
}

// Map a native ValidityState to our narrowed FieldFailure. Order matters:
// valueMissing is checked first because an empty required field can also report
// other flags as false-but-irrelevant; "you left it blank" is the message to show.
export function classifyFailure(validity: ValidityFlags): FieldFailure {
	if (validity.valueMissing) return 'valueMissing';
	if (validity.typeMismatch) return 'typeMismatch';
	if (validity.tooShort) return 'tooShort';
	if (validity.patternMismatch) return 'patternMismatch';
	if (validity.tooLong) return 'tooLong';
	return 'other';
}

// The inputs the message generator needs: the field's human label (so the message
// names the field — "Speak thy Mustard Address"), and the classified failure.
// minLength is optional context so the too-short message can name the requirement.
export interface FieldMessageContext {
	label: string;
	failure: FieldFailure;
	minLength?: number;
}

// Per-field, voice-flavored overrides. Generic templates name the field via its
// label; these special-case the two marquee gate fields (the mustard-address email
// and the eight-mark Seal) for extra cult flavor. Keyed by lowercased label so the
// forms don't have to pass a separate identifier.
const EMAIL_LABELS = new Set(['mustard address']);
const SEAL_LABELS = new Set(['seal', 'new seal', 'confirm the seal']);
// The Snacktum Onboarding rite (TASK-092) names the @handle field the "Casing".
// Special-case it so the rite's required/charset failures read in the cult
// voice rather than the bare generic "Speak thy Casing." fallback.
const NAME_LABELS = new Set(['casing']);
// The Shrine wall composer (TASK-093) names its body field the "Word upon the
// Shrine". Special-case its required failure so an empty word reads in the cult
// voice rather than the bare generic "Speak thy Word upon the Shrine." fallback.
const WORD_LABELS = new Set(['word upon the shrine']);
// Your Litter (TASK-095) names the upload's photo field the "Relic Image". Special-
// case its required failure so a missing offering reads in the cult voice rather
// than the bare generic "Speak thy Relic Image." fallback.
const RELIC_LABELS = new Set(['relic image']);

function isEmailLabel(label: string): boolean {
	return EMAIL_LABELS.has(label.trim().toLowerCase());
}

function isSealLabel(label: string): boolean {
	return SEAL_LABELS.has(label.trim().toLowerCase());
}

function isNameLabel(label: string): boolean {
	return NAME_LABELS.has(label.trim().toLowerCase());
}

function isWordLabel(label: string): boolean {
	return WORD_LABELS.has(label.trim().toLowerCase());
}

function isRelicLabel(label: string): boolean {
	return RELIC_LABELS.has(label.trim().toLowerCase());
}

// Map a field's classified failure to a themed, field-naming message in the cult
// voice. Pure: same inputs always yield the same string, no DOM, no I/O.
export function validationMessage(context: FieldMessageContext): string {
	const { label, failure, minLength } = context;
	const email = isEmailLabel(label);
	const seal = isSealLabel(label);
	const name = isNameLabel(label);
	const word = isWordLabel(label);
	const relic = isRelicLabel(label);

	switch (failure) {
		case 'valueMissing':
			if (email) return 'Speak thy Mustard Address.';
			if (seal) return 'A Seal is required to pass.';
			if (name) return 'Inscribe thy Casing.';
			if (word) return 'Speak a word upon the shrine.';
			if (relic) return 'Choose a relic image to offer.';
			return `Speak thy ${label}.`;

		case 'typeMismatch':
			if (email) return 'That is no Mustard Address.';
			return `That is no proper ${label}.`;

		case 'tooShort': {
			if (seal) {
				const marks = minLength ?? 8;
				return `Thy Seal must be at least ${marks} marks.`;
			}
			if (minLength) {
				return `Thy ${label} must be at least ${minLength} marks.`;
			}
			return `Thy ${label} is too short.`;
		}

		case 'patternMismatch':
			return `That is no proper ${label}.`;

		case 'tooLong':
			return `Thy ${label} runs too long.`;

		case 'other':
		default:
			return `The Order cannot accept thy ${label}.`;
	}
}
