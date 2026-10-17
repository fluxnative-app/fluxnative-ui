import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer, getArchetype, getComponent, searchComponents, validateScreen } from './server.ts';

test('search_components ranks the recipe a plain-words need points at, by name, alias, use line and archetype', () => {
  assert.equal(searchComponents('row in a settings list with a chevron')[0]?.name, 'ListRow');
  assert.ok(searchComponents('settings row with a toggle', 3).map((c) => c.name).includes('ListRow'));
  assert.equal(searchComponents('quantity stepper')[0]?.name, 'Stepper');
  assert.equal(searchComponents('CtaButton')[0]?.name, 'Button');
  assert.equal(searchComponents('search bar')[0]?.name, 'SearchField');
  assert.ok(searchComponents('empty state', 3).some((c) => c.name === 'StateView'));
  assert.deepEqual(searchComponents('xyzzy'), []);
});

test('get_component answers by name or alias, with props and optionally the source', () => {
  const stepper = getComponent('QtyStepper', true);
  assert.equal(stepper?.name, 'Stepper');
  assert.ok(stepper?.props.some((p) => p.name === 'accessibilityLabel' && !p.optional));
  assert.match(stepper?.source ?? '', /export default function Stepper/);
  assert.equal(getComponent('Nope', false), null);
});

test('get_archetype lists the recipes made for an archetype, then the general ones, with summary and use line', () => {
  const checkout = getArchetype('cart-checkout');
  assert.ok(!('error' in checkout));
  assert.ok(checkout.recipes.some((r) => r.name === 'Stepper' && r.summary !== '' && r.use !== '' && r.from.endsWith('/Stepper')));
  assert.ok(checkout.general.some((r) => r.name === 'Button'));
  assert.ok(!checkout.general.some((g) => checkout.recipes.some((r) => r.name === g.name)));
  const other = getArchetype('other');
  assert.ok(!('error' in other));
  assert.deepEqual(other.recipes, []);
  assert.ok(other.general.length > 0);
});

test('get_archetype answers an unknown archetype with the valid ones', () => {
  const answer = getArchetype('checkout');
  assert.ok('error' in answer);
  assert.match(answer.error, /checkout/);
  assert.equal(answer.valid.length, 35);
  assert.ok(answer.valid.includes('cart-checkout') && answer.valid.includes('ai-chat'));
});

const GOOD = `import React from 'react';
import { ScrollView, Text } from 'react-native';
import Button from '../components/Button';
import { space, type } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';

export default function Screen() {
  const palette = usePalette();
  return (
    <ScrollView contentContainerStyle={{ padding: space[5] }}>
      <Text style={{ ...type.title, color: palette.foreground }}>Orders</Text>
      <Button label="Track order" onPress={() => {}} />
    </ScrollView>
  );
}
`;

test('validate_screen passes a clean screen and names what is wrong with a dirty one', () => {
  const ok = validateScreen(GOOD);
  assert.equal(ok.pass, true, JSON.stringify(ok.next));
  const bad = validateScreen(GOOD.replace('<Button label="Track order" onPress={() => {}} />', '<Button label="Track order" onPress={() => {}} colour="#ff0000" />').replace("color: palette.foreground", "color: '#111111'"));
  assert.equal(bad.pass, false);
  assert.ok(bad.next.some((line) => line.startsWith('props:') && line.includes('colour')));
  assert.ok(bad.next.some((line) => line.startsWith('tokens:')));
});

test('the server lists its seven tools and answers get_index under 9 KB over an in-memory transport', async () => {
  const server = createServer();
  const client = new Client({ name: 'test', version: '0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), ['get_archetype', 'get_component', 'get_design_rules', 'get_index', 'list_tokens', 'search_components', 'validate_screen']);
  const index = await client.callTool({ name: 'get_index', arguments: {} });
  const body = (index.content as Array<{ type: string; text: string }>)[0]?.text ?? '';
  assert.ok(body.startsWith('<!-- fluxnative-ui:catalog-index'));
  assert.ok(Buffer.byteLength(body) <= 9 * 1024);
  const found = await client.callTool({ name: 'search_components', arguments: { query: 'avatar with online dot' } });
  assert.match((found.content as Array<{ text: string }>)[0]?.text ?? '', /"name": "Avatar"/);
  const settings = await client.callTool({ name: 'get_archetype', arguments: { archetype: 'settings' } });
  assert.match((settings.content as Array<{ text: string }>)[0]?.text ?? '', /"name": "ListRow"/);
  const unknown = await client.callTool({ name: 'get_archetype', arguments: { archetype: 'nope' } });
  assert.equal(unknown.isError, true);
  assert.match((unknown.content as Array<{ text: string }>)[0]?.text ?? '', /"valid"/);
  await client.close();
  await server.close();
});
