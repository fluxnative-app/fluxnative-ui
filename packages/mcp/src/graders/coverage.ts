// coverage: how much of the catalog the screen actually uses for the brief.
// It passes when every expected *behaviour* recipe is rendered (kinds.ts):
// a screen that skips Press, TextField, Sheet or StateView re-implements a
// contract it will likely break. Expected *visual* recipes (Button, Chip,
// ScreenHeader…) are the template's look to draw as it likes, so they never
// fail coverage. The score stays the share of all expected recipes rendered,
// comparable with the 80% bar of A3.3 for metrics. States are reported
// alongside: the screen must take a `previewState` prop and mention every
// expected state as a string literal.

import ts from 'typescript';
import type { Catalog } from './catalog.ts';
import { kindOf, recipeKinds, type RecipeKind } from './kinds.ts';
import { catalogTag, forEachNode, jsxTags, propertyName, type Screen } from './source.ts';
import type { GradeResult } from './types.ts';

export interface Expect {
  /** Catalog components a good screen for the brief renders. */
  recipes: string[];
  /** `previewState` values the screen must render. */
  states: string[];
}

export interface KindCoverage {
  expected: string[];
  used: string[];
  missing: string[];
}

export interface CoverageDetails {
  /** Share of all expected recipes rendered, behaviour and visual alike (the score). */
  share: number;
  /** Every one must be rendered for the grade to pass. */
  behaviour: KindCoverage;
  /** Reported only: a template may draw its own. */
  visual: KindCoverage;
  used: string[];
  missing: string[];
  /** Catalog components used beyond the expectation. */
  extra: string[];
  states: {
    share: number;
    previewStateProp: boolean;
    found: string[];
    missing: string[];
  };
}

export function gradeCoverage(
  screen: Screen,
  catalog: Catalog,
  expect: Expect,
  kinds: ReadonlyMap<string, RecipeKind> = recipeKinds(),
): GradeResult<CoverageDetails> {
  const used = new Set<string>();
  for (const tag of jsxTags(screen.sf)) {
    const name = catalogTag(screen, tag);
    if (name !== null && catalog.components.has(name)) used.add(name);
  }
  // A hook counts when the screen calls it (`useAiChat()` imported from `../components/useAiChat`);
  // in a template, only a hook its manifest lists: its own `useCountdown` is not the recipe.
  forEachNode(screen.sf, (node) => {
    if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression)) return;
    const name = screen.componentImports.get(node.expression.text);
    if (name !== undefined && kinds.has(name) && (catalog.recipes?.has(name) ?? true)) used.add(name);
  });
  const hit = expect.recipes.filter((r) => used.has(r));
  const share = expect.recipes.length === 0 ? 1 : hit.length / expect.recipes.length;
  const byKind = (kind: RecipeKind): KindCoverage => {
    const expected = expect.recipes.filter((r) => kindOf(r, kinds) === kind);
    return { expected, used: expected.filter((r) => used.has(r)), missing: expected.filter((r) => !used.has(r)) };
  };
  const behaviour = byKind('behaviour');

  // A state counts when its name is used as a value (`previewState === 'empty'`,
  // `case 'empty':`, `{ empty: … }[previewState]`), not when it only appears in
  // the prop's type, which the prompt spells out, or as a JSX string like `tone="error"`.
  const literals = new Set<string>();
  let previewStateProp = false;
  forEachNode(screen.sf, (node) => {
    if (ts.isStringLiteralLike(node)) {
      const parent = node.parent;
      if (ts.isLiteralTypeNode(parent) || ts.isJsxAttribute(parent) || ts.isImportDeclaration(parent)) return;
      literals.add(node.text);
    } else if (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) {
      const key = propertyName(node.name);
      if (key !== null) literals.add(key);
    } else if (ts.isIdentifier(node) && node.text === 'previewState') {
      previewStateProp = true;
    }
  });
  const found = expect.states.filter((s) => literals.has(s));
  const stateShare = !previewStateProp ? 0 : expect.states.length === 0 ? 1 : found.length / expect.states.length;

  return {
    pass: behaviour.missing.length === 0,
    score: share,
    details: {
      share,
      behaviour,
      visual: byKind('visual'),
      used: [...used].sort(),
      missing: expect.recipes.filter((r) => !used.has(r)),
      extra: [...used].filter((u) => !expect.recipes.includes(u)).sort(),
      states: { share: stateShare, previewStateProp, found, missing: expect.states.filter((s) => !literals.has(s)) },
    },
  };
}
