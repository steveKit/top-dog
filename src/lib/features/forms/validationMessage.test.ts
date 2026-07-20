import { describe, it, expect } from 'vitest';

import { classifyFailure, validationMessage, type FieldFailure } from './validationMessage';

// TASK (M8 themed form validation): the PURE message layer maps a field's human
// label + which native constraint failed to a themed, FIELD-NAMING message in the
// cult voice. These tests pin the marquee special-cases (Mustard Address email,
// the eight-mark Seal) and the generic, label-naming fallbacks. The tester will
// expand coverage + add the submit-time E2E.

describe('classifyFailure', () => {
	it('reports valueMissing first when an empty required field is present', () => {
		// An empty required field can report other flags too; "you left it blank"
		// wins so the user sees the actionable message.
		expect(classifyFailure({ valueMissing: true, typeMismatch: true })).toBe('valueMissing');
	});

	it('maps each native validity flag to its failure', () => {
		expect(classifyFailure({ typeMismatch: true })).toBe('typeMismatch');
		expect(classifyFailure({ tooShort: true })).toBe('tooShort');
		expect(classifyFailure({ patternMismatch: true })).toBe('patternMismatch');
		expect(classifyFailure({ tooLong: true })).toBe('tooLong');
	});

	it('orders the remaining flags typeMismatch > tooShort > patternMismatch > tooLong', () => {
		// Precedence when several non-valueMissing flags are set at once: the
		// classifier returns the first in declared order so the message is stable.
		expect(classifyFailure({ typeMismatch: true, tooShort: true, patternMismatch: true })).toBe(
			'typeMismatch'
		);
		expect(classifyFailure({ tooShort: true, patternMismatch: true, tooLong: true })).toBe(
			'tooShort'
		);
		expect(classifyFailure({ patternMismatch: true, tooLong: true })).toBe('patternMismatch');
	});

	it('treats valueMissing as highest priority over every other flag', () => {
		expect(
			classifyFailure({
				valueMissing: true,
				typeMismatch: true,
				tooShort: true,
				patternMismatch: true,
				tooLong: true
			})
		).toBe('valueMissing');
	});

	it('falls back to "other" when no known flag is set', () => {
		expect(classifyFailure({})).toBe('other');
		// An all-false ValidityState (every constraint passes) is still "other" —
		// classifyFailure never returns a failure for a valid control.
		expect(
			classifyFailure({
				valueMissing: false,
				typeMismatch: false,
				tooShort: false,
				patternMismatch: false,
				tooLong: false
			})
		).toBe('other');
	});
});

describe('validationMessage', () => {
	it('names the email field in the cult voice when empty', () => {
		expect(validationMessage({ label: 'Mustard Address', failure: 'valueMissing' })).toBe(
			'Speak thy Mustard Address.'
		);
	});

	it('uses the Seal voice when a required Seal is empty', () => {
		expect(validationMessage({ label: 'Seal', failure: 'valueMissing' })).toBe(
			'A Seal is required to pass.'
		);
		expect(validationMessage({ label: 'New Seal', failure: 'valueMissing' })).toBe(
			'A Seal is required to pass.'
		);
	});

	it('rejects a malformed mustard-address', () => {
		expect(validationMessage({ label: 'Mustard Address', failure: 'typeMismatch' })).toBe(
			'That is no Mustard Address.'
		);
	});

	it('uses the Seal voice for the third Seal label variant when empty', () => {
		// SEAL_LABELS also covers the sign-up confirm field; pin it so a future
		// label rename doesn't silently drop the Seal special-case.
		expect(validationMessage({ label: 'Confirm the Seal', failure: 'valueMissing' })).toBe(
			'A Seal is required to pass.'
		);
	});

	it('matches the email/Seal special-cases case-insensitively and trimmed', () => {
		// fieldLabel passes the visible label verbatim; the module lowercases +
		// trims so casing/whitespace from the markup can't defeat the special-case.
		expect(validationMessage({ label: '  MUSTARD ADDRESS  ', failure: 'valueMissing' })).toBe(
			'Speak thy Mustard Address.'
		);
		expect(validationMessage({ label: ' seal ', failure: 'valueMissing' })).toBe(
			'A Seal is required to pass.'
		);
	});

	it('produces a generic typeMismatch message naming a non-email field', () => {
		expect(validationMessage({ label: 'Recovery Code', failure: 'typeMismatch' })).toBe(
			'That is no proper Recovery Code.'
		);
	});

	it('names the minimum marks when the Seal is too short', () => {
		expect(validationMessage({ label: 'New Seal', failure: 'tooShort', minLength: 8 })).toBe(
			'Thy Seal must be at least 8 marks.'
		);
	});

	it('defaults the Seal minimum to 8 marks when no minLength is given', () => {
		expect(validationMessage({ label: 'Seal', failure: 'tooShort' })).toBe(
			'Thy Seal must be at least 8 marks.'
		);
	});

	it('names a generic required field by its label', () => {
		expect(validationMessage({ label: 'Invite token', failure: 'valueMissing' })).toBe(
			'Speak thy Invite token.'
		);
	});

	it('names a generic too-short field with its minimum', () => {
		expect(validationMessage({ label: 'Recovery Code', failure: 'tooShort', minLength: 6 })).toBe(
			'Thy Recovery Code must be at least 6 marks.'
		);
	});

	it('falls back to a min-less too-short message for a generic field', () => {
		// Without a minLength on a non-Seal field there is no number to name, so the
		// message degrades to the bare "too short" form (no "at least N marks").
		expect(validationMessage({ label: 'Recovery Code', failure: 'tooShort' })).toBe(
			'Thy Recovery Code is too short.'
		);
	});

	it('names the Seal minimum from the supplied minLength rather than the default', () => {
		// The Seal default is 8, but an explicit minLength must win so the message
		// tracks the field's real constraint.
		expect(validationMessage({ label: 'Seal', failure: 'tooShort', minLength: 12 })).toBe(
			'Thy Seal must be at least 12 marks.'
		);
	});

	it('produces a themed too-long message naming the field', () => {
		expect(validationMessage({ label: 'Recovery Code', failure: 'tooLong' })).toBe(
			'Thy Recovery Code runs too long.'
		);
	});

	it('produces a themed pattern-mismatch message naming the field', () => {
		expect(validationMessage({ label: 'Recovery Code', failure: 'patternMismatch' })).toBe(
			'That is no proper Recovery Code.'
		);
	});

	it('has a themed fallback for unknown failures', () => {
		const failure: FieldFailure = 'other';
		expect(validationMessage({ label: 'Invite token', failure })).toBe(
			'The Order cannot accept thy Invite token.'
		);
	});

	// The onboarding rite (TASK-092) names the @handle field the "Casing"; the Shrine
	// wall composer (TASK-093) names its body the "Word upon the Shrine". Both add a
	// themed valueMissing special-case so an empty field reads in the cult voice
	// rather than the bare generic "Speak thy <label>." fallback. Pin them so a
	// future label rename can't silently drop the special-case.
	describe('themed field-label special-cases', () => {
		it('uses the Casing voice when the required handle field is empty', () => {
			expect(validationMessage({ label: 'Casing', failure: 'valueMissing' })).toBe(
				'Inscribe thy Casing.'
			);
		});

		it('matches the Casing special-case case-insensitively and trimmed', () => {
			expect(validationMessage({ label: '  CASING  ', failure: 'valueMissing' })).toBe(
				'Inscribe thy Casing.'
			);
		});

		it('states the allowed charset when the Casing has a bad character (patternMismatch)', () => {
			// FIX-RITE-VALIDATION: a bad-charset handle (e.g. one with a space) must be
			// told WHAT is allowed, not just "that is no proper Casing". The message
			// must name letters, numbers, and underscores.
			const message = validationMessage({ label: 'Casing', failure: 'patternMismatch' });
			expect(message).toBe('A Casing bears only letters, numbers, and underscores.');
			expect(message).toMatch(/letters/i);
			expect(message).toMatch(/numbers/i);
			expect(message).toMatch(/underscores/i);
		});

		it('matches the Casing patternMismatch special-case case-insensitively and trimmed', () => {
			expect(validationMessage({ label: '  CASING  ', failure: 'patternMismatch' })).toBe(
				'A Casing bears only letters, numbers, and underscores.'
			);
		});

		// FIX-RITE-VALIDATION: the rite's Summoned step names the invite field the
		// "Your Summoning Token". Its empty / malformed failures get themed copy so the
		// first-step token error doesn't read as the awkward generic "Speak thy Your
		// Summoning Token." / "That is no proper Your Summoning Token." fallback.
		describe('Summoning token field special-case', () => {
			it('uses the token voice when the required Summoning Token is empty', () => {
				expect(validationMessage({ label: 'Your Summoning Token', failure: 'valueMissing' })).toBe(
					'Present thy Summoning Token.'
				);
			});

			it('uses the token voice for a malformed Summoning Token', () => {
				expect(
					validationMessage({ label: 'Your Summoning Token', failure: 'patternMismatch' })
				).toBe('That is no true Summoning Token.');
			});

			it('matches the Summoning Token special-case case-insensitively and trimmed', () => {
				expect(
					validationMessage({ label: '  YOUR SUMMONING TOKEN  ', failure: 'patternMismatch' })
				).toBe('That is no true Summoning Token.');
			});
		});

		it('uses the Shrine voice when the wall composer (Word upon the Shrine) is empty', () => {
			expect(validationMessage({ label: 'Word upon the Shrine', failure: 'valueMissing' })).toBe(
				'Speak a word upon the shrine.'
			);
		});

		it('matches the Word-upon-the-Shrine special-case case-insensitively and trimmed', () => {
			expect(
				validationMessage({ label: '  WORD UPON THE SHRINE  ', failure: 'valueMissing' })
			).toBe('Speak a word upon the shrine.');
		});

		it('falls through to the generic non-valueMissing templates for the Shrine word field', () => {
			// Only the valueMissing case is special-cased; a too-long body still uses
			// the generic, label-naming template (the wall textarea has a maxlength).
			expect(validationMessage({ label: 'Word upon the Shrine', failure: 'tooLong' })).toBe(
				'Thy Word upon the Shrine runs too long.'
			);
		});

		it('uses the Relic Image voice when the required upload photo field is empty', () => {
			// Your Litter (TASK-095) names the upload photo field the "Relic Image";
			// an empty offering reads in the cult voice, not the bare generic fallback.
			expect(validationMessage({ label: 'Relic Image', failure: 'valueMissing' })).toBe(
				'Choose a relic image to offer.'
			);
		});

		it('matches the Relic Image special-case case-insensitively and trimmed', () => {
			expect(validationMessage({ label: '  RELIC IMAGE  ', failure: 'valueMissing' })).toBe(
				'Choose a relic image to offer.'
			);
		});

		// Whispers (TASK-097) names the DM compose field the "Whisper unto <member>…",
		// where the label EMBEDS the counterparty's display name. Unlike every other
		// special-case (exact-set membership), this one is matched by PREFIX — a new
		// mechanism — so it must (a) fire for any "Whisper unto …" label regardless of
		// the trailing name, (b) stay case-insensitive/trim-tolerant like the rest,
		// and (c) NOT over-match unrelated labels that merely contain the word
		// "whisper".
		describe('Whisper compose field (prefix-matched special-case)', () => {
			it('uses the whisper voice when the required compose body is empty', () => {
				expect(
					validationMessage({ label: 'Whisper unto Chef Dog…', failure: 'valueMissing' })
				).toBe('Speak thy whisper, faithful one.');
			});

			it('fires for any counterparty name embedded in the prefix label', () => {
				// The trailing name varies per conversation; the prefix match must not
				// depend on a specific name.
				expect(
					validationMessage({ label: 'Whisper unto Brunhilda the Wurst', failure: 'valueMissing' })
				).toBe('Speak thy whisper, faithful one.');
			});

			it('matches the whisper prefix case-insensitively and trimmed', () => {
				// fieldLabel passes the visible label verbatim; the module lowercases +
				// trims so casing/whitespace from the markup can't defeat the prefix.
				expect(
					validationMessage({ label: '  WHISPER UNTO Chef Dog…  ', failure: 'valueMissing' })
				).toBe('Speak thy whisper, faithful one.');
			});

			it('falls through to the generic non-valueMissing templates for the whisper field', () => {
				// Only the valueMissing case is special-cased; a too-long whisper still
				// uses the generic, label-naming template (the compose textarea has a
				// maxlength). This also proves the prefix special-case doesn't hijack
				// other failure kinds.
				expect(validationMessage({ label: 'Whisper unto Chef Dog…', failure: 'tooLong' })).toBe(
					'Thy Whisper unto Chef Dog… runs too long.'
				);
			});

			it('does NOT over-match an unrelated label that merely contains "whisper"', () => {
				// The match is a PREFIX, not a substring: a label that mentions "whisper"
				// but doesn't START with "whisper unto " must fall back to the generic
				// label-naming template, not the themed whisper copy.
				expect(validationMessage({ label: 'Secret Whisper Token', failure: 'valueMissing' })).toBe(
					'Speak thy Secret Whisper Token.'
				);
			});

			it('does NOT over-match the bare word "Whisper" without the "unto " continuation', () => {
				// A field literally named "Whisper" (no "unto ") is not the DM compose
				// box; it must not pick up the embedded-name themed copy.
				expect(validationMessage({ label: 'Whisper', failure: 'valueMissing' })).toBe(
					'Speak thy Whisper.'
				);
			});
		});
	});
});
