// shadow-primitive: a screen that re-implements a catalog primitive instead
// of using it. This is the duplication the template audit found (A1.3:
// local Press, SkeletonShimmer, StateBlock, CtaButton, CircleButton, Icons…).
// Heuristics, so every finding names its rule and line:
//   - name: a local component named like a primitive (`CtaButton`,
//     `FilterChip`, `EmptyState`, `HeartIcon`) that doesn't render that
//     primitive. Rendering it makes the wrapper a composition, which is fine.
//   - scale-press: a raw Pressable/Touchable with onPressIn/onPressOut in a
//     file that springs or times a `scale` (Press re-implemented).
//   - modal: a react-native `<Modal>` (Sheet draws inside the screen, never Modal).
//   - icon-svg: an `<Svg viewBox="0 0 24 24">` (an icon drawn by hand; Icon has the table).
// A copy of a *behaviour* recipe (kinds.ts: Press, Sheet, TextField,
// StateView…) is a finding and fails the grade. A copy of a *visual* one
// (Button, Chip, Icon, ScreenHeader…) is a warning: the template's own look
// is its identity, so drawing it by hand is reported, never failed.

import ts from 'typescript';
import { catalogTag, defaultExportName, forEachNode, jsxTags, lineOf, tagName, unwrap, type JsxTag, type Screen } from './source.ts';
import { countScore, type GradeResult } from './types.ts';
import { kindOf, recipeKinds, type RecipeKind } from './kinds.ts';

export type ShadowRule = 'name' | 'scale-press' | 'modal' | 'icon-svg';

export interface ShadowFinding {
  rule: ShadowRule;
  primitive: string;
  /** The primitive's kind: `behaviour` findings fail, `visual` ones are warnings. */
  kind: RecipeKind;
  line: number;
  message: string;
}

export interface Composition {
  name: string;
  wraps: string;
}

export interface ShadowDetails {
  /** Copies of behaviour recipes: any one fails the grade. */
  findings: ShadowFinding[];
  /** Copies of visual recipes: reported, never failed (a template may draw its own look). */
  warnings: ShadowFinding[];
  /** Local components that wrap a primitive (allowed: the kit's backlog, not duplication). */
  compositions: Composition[];
  /** Raw Pressable / Touchable* elements: not a finding, but each one skips Press (haptics, label, scale). */
  rawPressables: number;
}

interface NameRule {
  primitive: string;
  name: RegExp;
  /** Rendering one of these makes the local component a composition. */
  via: readonly string[];
}

/** First match wins, so the specific button shapes come before `*Button`. */
const NAME_RULES: readonly NameRule[] = [
  { primitive: 'SearchField', name: /^Search(?:Field|Bar|Box|Input|Pill)$/, via: ['SearchField'] },
  { primitive: 'TextField', name: /^(?:Text|Form|Password|Email|Phone|Labou?r?ed)?(?:Field|Input)$|^(?:Labell?ed|Form)Input$|^TextField$/, via: ['TextField'] },
  { primitive: 'Stepper', name: /^(?:Qty|Quantity)?Stepper$|^QuantityControl$|^PlusMinus$|^Counter$/, via: ['Stepper'] },
  { primitive: 'SegmentedControl', name: /^Segmented(?:Control|Tabs)?$|^(?:Tab|Period)Switch(?:er)?$|^TopTabs$/, via: ['SegmentedControl'] },
  { primitive: 'ListGroup', name: /^(?:List|Settings|Menu|Inset)(?:Group|Section)$/, via: ['ListGroup'] },
  { primitive: 'ListRow', name: /^(?:List|Settings|Menu|Option|Nav|Detail)(?:Row|Item|Cell)$|^Cell$|^NavMenu$/, via: ['ListRow'] },
  { primitive: 'Notice', name: /^(?:Info|Warning|Error|Promo|Inline)?(?:Notice|Banner|Callout|Alert)$/, via: ['Notice', 'StateView'] },
  // Before BottomBar and Chip: BottomDock and TabPill are tab bars in the catalog, not a CTA bar or a chip.
  { primitive: 'TabBar', name: /^(?:\w*Tab(?:Bar|Dock|Pill|s)|\w*Dock|Bottom(?:Nav|Tabs))$/, via: ['TabBar'] },
  { primitive: 'BottomBar', name: /^(?:Bottom|Action|Checkout|Cta|Sticky)(?:Bar|Dock|Footer)$|^StickyFooter$/, via: ['BottomBar', 'Button'] },
  { primitive: 'ScreenHeader', name: /^(?:Screen|Nav|Top|Page)?(?:Header|Bar)$|^ScreenShell$|^NavBar$|^Header$/, via: ['ScreenHeader', 'IconButton'] },
  { primitive: 'Avatar', name: /^(?:User|Profile)?Avatar$|^Initials$|^ProfilePhoto$/, via: ['Avatar'] },
  { primitive: 'ProgressBar', name: /^(?:Progress|Goal|Meter)(?:Bar)?$|^ProgressBar$|^LinearProgress$/, via: ['ProgressBar'] },
  { primitive: 'PageDots', name: /^(?:Page|Pager)?(?:Dots|Indicator)$|^Pager$|^PageIndicator$/, via: ['PageDots'] },
  { primitive: 'Rating', name: /^(?:Star)?Rating$|^Stars$|^StarRow$|^ReviewStars$/, via: ['Rating'] },
  { primitive: 'Photo', name: /^(?:Remote|Lazy|Loaded)?(?:Photo|Image)$|^(?:Cover|Thumb)(?:nail)?$/, via: ['Photo', 'Skeleton'] },
  { primitive: 'Divider', name: /^(?:Divider|Hairline|Rule|Separator)$/, via: ['Divider'] },
  { primitive: 'IconButton', name: /^(?:Icon|Circle|Round|Fab|Floating)[A-Za-z]*Button$|^Fab$/, via: ['IconButton'] },
  { primitive: 'Button', name: /^(?:[A-Z][A-Za-z]*)?Button$|^Cta$/, via: ['Button', 'IconButton', 'Chip'] },
  { primitive: 'Chip', name: /^(?:[A-Z][A-Za-z]*)?(?:Chip|Pill)$/, via: ['Chip'] },
  { primitive: 'SkeletonRows', name: /^(?:Skeleton|Loading|Placeholder|Shimmer)(?:Rows?|List|Items?)$|^(?:List|Row)Skeleton$/, via: ['SkeletonRows', 'Skeleton'] },
  { primitive: 'StatTile', name: /^(?:Stat|Metric|Kpi)(?:Tile|Card|Block|Box|Item)?$/, via: ['StatTile'] },
  { primitive: 'Skeleton', name: /Skeleton|Shimmer|Placeholder/, via: ['Skeleton'] },
  {
    primitive: 'StateView',
    name: /^(?:State(?:Block|Notice|View)|(?:Empty|Error|Offline)(?:State|View|Block|Notice|Banner|Message|Card)?)$/,
    via: ['StateView'],
  },
  { primitive: 'Sheet', name: /(?:Sheet|Drawer|Modal|Dialog)$/, via: ['Sheet'] },
  { primitive: 'Reveal', name: /^(?:Reveal|FadeIn|Appear|Stagger|Entrance)[A-Za-z]*$/, via: ['Reveal'] },
  { primitive: 'SectionHeader', name: /^Section(?:Header|Title|Heading)$/, via: ['SectionHeader'] },
  { primitive: 'Scrim', name: /^(?:Scrim|Backdrop|Overlay)$/, via: ['Scrim', 'Sheet'] },
  { primitive: 'Press', name: /^(?:Press|Pressable|Touchable|Tappable|ScalePress|PressScale|Bounce)[A-Za-z]*$/, via: ['Press'] },
  { primitive: 'Icon', name: /^(?:Glyph[A-Za-z]*|(?:[A-Z][A-Za-z]*)?Icons?)$/, via: ['Icon'] },
];

const RAW_PRESSABLES = new Set(['Pressable', 'TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback', 'TouchableNativeFeedback']);

interface LocalComponent {
  name: string;
  node: ts.Node;
  line: number;
}

export function gradeShadowPrimitive(screen: Screen, kinds: ReadonlyMap<string, RecipeKind> = recipeKinds()): GradeResult<ShadowDetails> {
  const { sf } = screen;
  const all: Array<Omit<ShadowFinding, 'kind'>> = [];
  const compositions: Composition[] = [];
  const flagged: Array<{ node: ts.Node; kind: RecipeKind }> = [];
  const screenName = defaultExportName(sf);

  for (const local of localComponents(sf)) {
    if (local.name === screenName) continue;
    const rule = NAME_RULES.find((r) => r.name.test(local.name));
    if (rule === undefined) continue;
    const rendered = new Set(jsxTags(local.node).map((tag) => catalogTag(screen, tag)).filter((name) => name !== null));
    const wraps = rule.via.find((primitive) => rendered.has(primitive));
    if (wraps !== undefined) {
      compositions.push({ name: local.name, wraps });
      continue;
    }
    flagged.push({ node: local.node, kind: kindOf(rule.primitive, kinds) });
    all.push({ rule: 'name', primitive: rule.primitive, line: local.line, message: `local ${local.name} re-implements ${rule.primitive}` });
  }

  // A finding inside a flagged local component is already said, unless the component is only a visual
  // copy and the finding is a behaviour one: a hand-drawn CtaButton may keep its look, not its own scale press.
  const inFlagged = (node: ts.Node, primitive: string) =>
    flagged.some((f) => node.pos >= f.node.pos && node.end <= f.node.end && (f.kind === 'behaviour' || kindOf(primitive, kinds) === 'visual'));
  const reactNativeImports = importedFrom(sf, 'react-native');
  const animatesScale = /\bAnimated\.(?:spring|timing)\s*\(/.test(screen.code) && /\bscale\b/.test(screen.code);
  let rawPressables = 0;

  for (const tag of jsxTags(sf)) {
    const name = tagName(tag);
    if (RAW_PRESSABLES.has(name) && reactNativeImports.has(name)) {
      rawPressables += 1;
      if (animatesScale && hasAttribute(tag, ['onPressIn', 'onPressOut']) && !inFlagged(tag, 'Press')) {
        all.push({ rule: 'scale-press', primitive: 'Press', line: lineOf(sf, tag.getStart()), message: `${name} with a scale animation re-implements Press` });
      }
    } else if (name === 'Modal' && reactNativeImports.has('Modal') && !inFlagged(tag, 'Sheet')) {
      all.push({ rule: 'modal', primitive: 'Sheet', line: lineOf(sf, tag.getStart()), message: 'react-native Modal: use Sheet, which draws inside the screen' });
    } else if (name === 'Svg' && attributeText(tag, 'viewBox')?.trim() === '0 0 24 24' && !inFlagged(tag, 'Icon')) {
      all.push({ rule: 'icon-svg', primitive: 'Icon', line: lineOf(sf, tag.getStart()), message: 'hand-drawn 24-unit icon: use Icon with a name from its table' });
    }
  }

  const graded = all.map((f): ShadowFinding => ({ ...f, kind: kindOf(f.primitive, kinds) })).sort((a, b) => a.line - b.line);
  const findings = graded.filter((f) => f.kind === 'behaviour');
  const warnings = graded.filter((f) => f.kind === 'visual');
  return { pass: findings.length === 0, score: countScore(findings.length), details: { findings, warnings, compositions, rawPressables } };
}

/** Function components declared anywhere in the file: `function Name()` and `const Name = () =>` (memo/forwardRef too). */
function localComponents(sf: ts.SourceFile): LocalComponent[] {
  const out: LocalComponent[] = [];
  forEachNode(sf, (node) => {
    if (ts.isFunctionDeclaration(node) && node.name !== undefined && /^[A-Z]/.test(node.name.text)) {
      out.push({ name: node.name.text, node, line: lineOf(sf, node.getStart()) });
    } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && /^[A-Z]/.test(node.name.text) && node.initializer !== undefined) {
      if (isFunctionLike(node.initializer)) out.push({ name: node.name.text, node, line: lineOf(sf, node.getStart()) });
    }
  });
  return out;
}

function isFunctionLike(expr: ts.Expression): boolean {
  const inner = unwrap(expr);
  if (ts.isArrowFunction(inner) || ts.isFunctionExpression(inner)) return true;
  // React.memo(() => …), forwardRef(function X() {…})
  return ts.isCallExpression(inner) && inner.arguments.some((arg) => isFunctionLike(arg));
}

function importedFrom(sf: ts.SourceFile, module: string): Set<string> {
  const names = new Set<string>();
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) || !ts.isStringLiteral(stmt.moduleSpecifier) || stmt.moduleSpecifier.text !== module) continue;
    const bindings = stmt.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const el of bindings.elements) names.add(el.name.text);
  }
  return names;
}

function hasAttribute(tag: JsxTag, names: readonly string[]): boolean {
  return tag.attributes.properties.some((attr) => ts.isJsxAttribute(attr) && ts.isIdentifier(attr.name) && names.includes(attr.name.text));
}

function attributeText(tag: JsxTag, name: string): string | undefined {
  for (const attr of tag.attributes.properties) {
    if (!ts.isJsxAttribute(attr) || !ts.isIdentifier(attr.name) || attr.name.text !== name || attr.initializer === undefined) continue;
    const init = attr.initializer;
    if (ts.isStringLiteral(init)) return init.text;
    if (ts.isJsxExpression(init) && init.expression !== undefined && ts.isStringLiteralLike(init.expression)) return init.expression.text;
  }
  return undefined;
}
