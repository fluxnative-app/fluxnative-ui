// What each recipe owns, from registry.meta.json's `recipeKind`: a
// `behaviour` recipe carries an interaction or system contract (press target,
// text input, switch semantics, modal dismissal, loading / empty / error
// states, the AI hooks) that a hand-made copy tends to break, so the graders
// require it; a `visual` recipe is presentation, part of a template's
// identity, so skipping or redrawing it never fails a screen.

import { readRegistryMeta, type RecipeKind } from '@fluxnative/catalog';

export type { RecipeKind } from '@fluxnative/catalog';

let memo: ReadonlyMap<string, RecipeKind> | null = null;

export function recipeKinds(): ReadonlyMap<string, RecipeKind> {
  memo ??= new Map(Object.entries(readRegistryMeta()).map(([name, meta]) => [name, meta.recipeKind]));
  return memo;
}

/** A name the registry doesn't know counts as behaviour: an expectation is never loosened by a typo. */
export function kindOf(name: string, kinds: ReadonlyMap<string, RecipeKind> = recipeKinds()): RecipeKind {
  return kinds.get(name) ?? 'behaviour';
}
