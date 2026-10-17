import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer, getComponent, searchComponents, validateScreen } from './server.ts';

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

test('the server lists its six tools and answers get_index under 9 KB over an in-memory transport', async () => {
  const server = createServer();
  const client = new Client({ name: 'test', version: '0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), ['get_component', 'get_design_rules', 'get_index', 'list_tokens', 'search_components', 'validate_screen']);
  const index = await client.callTool({ name: 'get_index', arguments: {} });
  const body = (index.content as Array<{ type: string; text: string }>)[0]?.text ?? '';
  assert.ok(body.startsWith('<!-- fluxnative-ui:catalog-index'));
  assert.ok(Buffer.byteLength(body) <= 9 * 1024);
  const found = await client.callTool({ name: 'search_components', arguments: { query: 'avatar with online dot' } });
  assert.match((found.content as Array<{ text: string }>)[0]?.text ?? '', /"name": "Avatar"/);
  await client.close();
  await server.close();
});

test('get_design_rules serves CRAFT.index.md: versioned, at most 4 KB, real photos allowed and placeholder services not', async () => {
  const server = createServer();
  const client = new Client({ name: 'test', version: '0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  const rules = await client.callTool({ name: 'get_design_rules', arguments: {} });
  const body = (rules.content as Array<{ type: string; text: string }>)[0]?.text ?? '';
  assert.match(body, /^<!-- fluxnative-ui:craft-index v\d+\.\d+\.\d+ /);
  assert.ok(Buffer.byteLength(body) <= 4096, `CRAFT.index.md is ${Buffer.byteLength(body)} bytes`);
  const imagery = body.split('\n').find((line) => line.startsWith('5. **Imagery.**')) ?? '';
  assert.match(imagery, /Unsplash API/);
  assert.doesNotMatch(imagery, /never Unsplash/i);
  assert.match(imagery, /`Photo` with `alt` and `fallback`/);
  assert.match(imagery, /Never picsum or placeholder services/);
  const palette = body.split('\n').find((line) => line.startsWith('2. **Palette.**')) ?? '';
  assert.match(palette, /built with depth, never flattened/);
  await client.close();
  await server.close();
});
