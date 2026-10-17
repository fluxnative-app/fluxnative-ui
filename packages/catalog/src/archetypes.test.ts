import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { AI_ARCHETYPES, ARCHETYPES, ARCHETYPE_MAP_FILE, isArchetype, renderArchetypeMap, renderArchetypeMapJson, unknownArchetypes } from './archetypes.ts';
import { renderRegistry, type Registry } from './registry.ts';

const registry = renderRegistry();

test('ARCHETYPES is OpenDesign\'s 30 plus the five AI ones, without duplicates', () => {
  assert.equal(ARCHETYPES.length, 35);
  assert.equal(new Set(ARCHETYPES).size, 35);
  assert.deepEqual(ARCHETYPES.slice(30), [...AI_ARCHETYPES]);
  assert.ok(isArchetype('cart-checkout'));
  assert.ok(!isArchetype('*'));
  assert.ok(!isArchetype('checkout'));
});

test('every archetypes[] value in the registry is on ARCHETYPES or *', () => {
  assert.deepEqual(unknownArchetypes(registry), []);
});

test('registry.archetypes.json is deterministic and fresh', () => {
  const json = renderArchetypeMapJson(registry);
  assert.equal(renderArchetypeMapJson(renderRegistry()), json);
  assert.equal(readFileSync(ARCHETYPE_MAP_FILE, 'utf8'), json, 'run `pnpm tokens`');
  assert.deepEqual(Object.keys(renderArchetypeMap(registry).archetypes), [...ARCHETYPES]);
});

test('an archetype lists the recipes that name it, most evidence first, then the general ones not already listed', () => {
  const map = renderArchetypeMap(registry).archetypes;
  const evidence = (name: string) => registry.components.find((c) => c.name === name)?.evidence.templates ?? 0;
  const checkout = map['cart-checkout'];
  assert.ok(checkout.recipes.includes('Stepper') && checkout.recipes.includes('BottomBar'));
  for (let i = 1; i < checkout.recipes.length; i += 1) assert.ok(evidence(checkout.recipes[i - 1] ?? '') >= evidence(checkout.recipes[i] ?? ''), checkout.recipes.join(', '));
  assert.ok(checkout.general.includes('Button'));
  assert.ok(!checkout.general.includes('Snackbar'), 'Snackbar names cart-checkout, so it is not repeated under general');
  assert.ok(map.loading.recipes.includes('Skeleton') && !map.loading.general.includes('Skeleton'));
});

test('behaviour lists, in order, the names of recipes and general whose recipeKind is behaviour', () => {
  const kind = new Map(registry.components.map((c) => [c.name, c.recipeKind]));
  const map = renderArchetypeMap(registry);
  assert.equal(map.mapVersion, 2);
  for (const [archetype, entry] of Object.entries(map.archetypes)) {
    assert.deepEqual(entry.behaviour, [...entry.recipes, ...entry.general].filter((name) => kind.get(name) === 'behaviour'), archetype);
  }
  const checkout = map.archetypes['cart-checkout'];
  assert.ok(checkout.behaviour.includes('Press') && checkout.behaviour.includes('useDockInset'), 'general behaviour recipes count for every archetype');
  assert.ok(!checkout.behaviour.includes('Button') && !checkout.behaviour.includes('BottomBar'), 'visual recipes are left out');
  assert.ok(map.archetypes['ai-chat'].behaviour.includes('useAiChat'));
  assert.ok(map.archetypes.other.behaviour.length > 0, 'an archetype no recipe names still expects the general behaviour ones');
});

test('an archetype no recipe names still gets the general recipes', () => {
  const other = renderArchetypeMap(registry).archetypes.other;
  assert.deepEqual(other.recipes, []);
  assert.ok(other.general.length > 0);
  assert.deepEqual(new Set(other.general), new Set(registry.components.filter((c) => c.archetypes.includes('*')).map((c) => c.name)));
});

test('an archetype off the list fails the generation', () => {
  const first = registry.components[0];
  assert.ok(first);
  const bad: Registry = { ...registry, components: [{ ...first, archetypes: ['checkout'] }, ...registry.components.slice(1)] };
  assert.deepEqual(unknownArchetypes(bad), [`${first.name}: checkout`]);
  assert.throws(() => renderArchetypeMap(bad), /checkout/);
});
