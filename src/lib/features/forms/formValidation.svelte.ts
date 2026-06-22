// Top Dog M8 themed form validation — reusable client integration.
//
// This is the small shared layer the four gate forms (sign-in, sign-up,
// forgot-password, reset-password) wire in a couple of lines instead of
// duplicating the validation/a11y/focus logic. It owns the reactive per-field
// error map (Svelte $state, hence the `.svelte.ts` extension) and bridges the
// native Constraint Validation API to our PURE themed-message module
// (`validationMessage.ts`).
//
// Server-side validation is UNCHANGED — this is purely the client UX layer that
// replaces the browser's native validation bubble with themed inline copy. The
// form still POSTs to the same action, which still validates authoritatively.
//
// Usage in a +page.svelte:
//
//   const validation = createFormValidation();
//   <form novalidate use:enhance={validation.enhance(() => {
//     submitting = true;
//     return async ({ update }) => { await update(); submitting = false; };
//   })}>
//     <input name="email" ... oninput={validation.clearOnInput} ... />
//     {#if validation.errors.email}
//       <p class="field-error" role="alert" id="email-error">{validation.errors.email}</p>
//     {/if}
//
// `validation.describedBy(name)` / `validation.invalid(name)` produce the a11y
// attrs for each field so the markup stays terse.

import type { SubmitFunction } from '@sveltejs/kit';

import { classifyFailure, validationMessage } from './validationMessage';

// The validatable form controls this layer drives: <input> AND <textarea> (both
// participate in constraint validation, carry willValidate/validity/checkValidity,
// and a name). The Shrine wall composer (TASK-093) is a required <textarea>, so the
// canon must cover textareas, not inputs alone.
type ValidatableField = HTMLInputElement | HTMLTextAreaElement;

// Read the field's human label for messaging. Prefers the visible <span
// class="field-label"> inside the wrapping <label> (the gate forms' pattern),
// then a plain <label> text, then aria-label, then the name. Keeps the themed
// message naming the field the way the user sees it.
function fieldLabel(field: ValidatableField): string {
	const wrappingLabel = field.closest('label');
	if (wrappingLabel) {
		const span = wrappingLabel.querySelector('.field-label');
		const text = (span?.textContent ?? wrappingLabel.textContent ?? '').trim();
		if (text) return text;
	}
	const ariaLabel = field.getAttribute('aria-label');
	if (ariaLabel?.trim()) return ariaLabel.trim();
	return field.name;
}

// The validatable form controls we care about: inputs / textareas that
// participate in constraint validation and carry a name. willValidate is false
// for hidden / disabled controls, so they're skipped automatically.
function validatableInputs(form: HTMLFormElement): ValidatableField[] {
	return Array.from(form.elements).filter(
		(el): el is ValidatableField =>
			(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) &&
			el.willValidate &&
			el.name !== ''
	);
}

export interface FormValidation {
	// Reactive per-field error map, keyed by input name. A present string means the
	// field is currently showing a themed error; absent means valid.
	readonly errors: Record<string, string>;
	// Wraps an existing enhance SubmitFunction: validates first, cancels + focuses
	// on failure, otherwise delegates to the wrapped function unchanged.
	enhance: (inner?: SubmitFunction) => SubmitFunction;
	// oninput handler that clears a field's error on the first keystroke in it.
	clearOnInput: (event: Event) => void;
	// a11y helpers for terse markup.
	invalid: (name: string) => 'true' | undefined;
	describedBy: (name: string) => string | undefined;
	errorId: (name: string) => string;
}

export function createFormValidation(): FormValidation {
	const errors = $state<Record<string, string>>({});

	const errorId = (name: string) => `${name}-error`;

	// Remove a field's error, so the a11y attributes (`aria-invalid` /
	// `aria-describedby`, both derived from the `errors` entry) come off in
	// lockstep — no dangling describedby pointing at a removed <p>. This is the
	// single clearing path shared by clearOnInput and validate(); deleting the
	// entry fires the existing `errorSlideFade` leave animation. The error simply
	// re-appears on the next failed submit via re-validation.
	function clearError(name: string): void {
		delete errors[name];
	}

	// Validate every control in the form, populate `errors`, focus the first
	// invalid control, and return true when the form is valid.
	function validate(form: HTMLFormElement): boolean {
		let firstInvalid: ValidatableField | null = null;

		for (const input of validatableInputs(form)) {
			if (input.checkValidity()) {
				clearError(input.name);
				continue;
			}
			errors[input.name] = validationMessage({
				label: fieldLabel(input),
				failure: classifyFailure(input.validity),
				minLength: input.minLength > 0 ? input.minLength : undefined
			});
			if (!firstInvalid) firstInvalid = input;
		}

		if (firstInvalid) {
			firstInvalid.focus();
			return false;
		}
		return true;
	}

	const enhance: FormValidation['enhance'] = (inner) => {
		return (submitEvent) => {
			if (!validate(submitEvent.formElement)) {
				submitEvent.cancel();
				return;
			}
			return inner?.(submitEvent);
		};
	};

	// Hide a field's themed error on the FIRST keystroke in that field —
	// unconditionally, without waiting for the value to become valid. Per-field:
	// typing in one input clears only its own error. Routes through the shared
	// clearError so the message + a11y attrs come off together (no dangling
	// describedby) and the `errorSlideFade` leave animation still plays. The error
	// re-appears on the next failed submit via re-validation.
	const clearOnInput = (event: Event) => {
		const input = event.currentTarget;
		if (
			!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) ||
			input.name === ''
		)
			return;
		if (errors[input.name]) {
			clearError(input.name);
		}
	};

	return {
		errors,
		enhance,
		clearOnInput,
		invalid: (name) => (errors[name] ? 'true' : undefined),
		describedBy: (name) => (errors[name] ? errorId(name) : undefined),
		errorId
	};
}
