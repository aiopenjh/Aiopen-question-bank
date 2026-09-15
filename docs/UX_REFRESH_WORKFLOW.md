# Celueste UX Refresh Workflow

## Objective

Refresh Celueste into a polished, warm study product for older teenagers and adults without changing its local-first data model, AI generation pipeline, exam behavior, backup format, or deployment flow.

## Visual Direction

- Tone: editorial study planner with a refined celestial motif
- Audience: high-school students, university students, and adult learners
- Mood: focused, calm, encouraging, and subtly playful
- Avoid: infantile mascots, toy-like proportions, excessive emoji, loud gradients, decorative text inside images
- Palette: rose accent, warm ivory surfaces, deep navy text, restrained mint/lavender/gold status accents
- Illustration: a recurring young-adult celestial study guide with clean editorial linework, soft dimensional shading, transparent backgrounds, and no embedded text
- Character consistency: preserve the guide's face, navy hair, crescent hairpin, constellation wings, rose jacket, ivory knit, and navy trousers while varying pose, composition, props, and state accent colors

## Repeatable Implementation Loop

1. Identify the single user goal of the target screen.
2. Preserve all existing data, AI, backup, alarm, and exam contracts.
3. Reuse shared color, spacing, radius, typography, card, and button tokens before adding local styles.
4. Keep one primary action per screen or card group.
5. Use illustrations only for state communication: welcome, empty, complete, or waiting.
6. Keep secondary explanations to one short line and move rare actions away from the primary flow.
7. Check the result first at a 390px-class mobile viewport, then at desktop width.
8. Run only the verification requested for the current phase.
9. Never deploy or merge from this branch without explicit approval.

## Phase 1 Scope

- Establish shared UX tokens without introducing a new dependency.
- Refresh the home screen hierarchy and visual language.
- Create four related but compositionally distinct local illustration assets:
  - home: the guide seated on an open notebook
  - empty subject library: the guide presenting an open shelf
  - review complete: the guide marking a finished study card
  - AI generation waiting: the guide arranging newly formed question cards
- Create a separate symbolic app icon and Android adaptive foreground using the same celestial notebook identity.
- Integrate only the home illustration in the first screen pass.
- Keep the remaining assets ready for the later library, review, and generation-state passes.

## Architecture Rules

- `App.tsx` remains the orchestration layer.
- Feature screens own their information hierarchy.
- Shared visual tokens live under `src/styles/`.
- State-specific illustrations live under `assets/illustrations/`.
- No runtime image downloads; all final assets are bundled locally.
- No changes to storage keys, repositories, domain contracts, question generation, or answer distribution.

## Review Gate

The first mobile review covers only the home screen and shared visual direction. Library and settings changes begin only after the home direction is accepted.
