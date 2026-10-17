// `fluxnative-ui-grade`: every deterministic screen grader (dialect,
// typecheck, props, tokens, shadow-primitive, coverage) over `.tsx` files, for
// callers that don't speak MCP, such as the template factory's gate.
//
//   fluxnative-ui-grade [--expect <file.json>] [--json] <screen.tsx | dir>...
//
// A directory means every `*.tsx` directly in it; a screen's name is its file
// name without the extension. `--expect` gives the recipes and states a screen
// should cover, `{ recipes, states }` for every screen or
// `{ screens: { <Name>: { recipes, states } }, default: { … } }`. A screen with
// no expectation gets coverage `pass: null` ("na"), which never gates.
//
// Exit 0 when every screen passes every grader, 2 when a grader failed, 1 for
// a usage or runtime error, including a typecheck that could not run: that
// grader is then `{ pass: false, details: "unavailable: <reason>" }`, never a pass.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { loadCatalog, type Catalog } from './catalog.ts';
import type { Expect } from './coverage.ts';
import { gradeScreen, Typechecker, type ScreenGrades } from './index.ts';
import type { TypecheckDetails } from './typecheck.ts';
import type { GradeResult } from './types.ts';

export const USAGE = 'usage: fluxnative-ui-grade [--expect <file.json>] [--json] <screen.tsx | dir>...';

export const GRADERS = ['dialect', 'typecheck', 'props', 'tokens', 'shadowPrimitive', 'coverage'] as const;
export type GraderName = (typeof GRADERS)[number];

/** A grader's result as the report carries it: `pass: null` is "not applicable" and never gates. */
export interface ReportedGrade {
  pass: boolean | null;
  score: number | null;
  details: unknown;
}

export interface ScreenReport extends Record<GraderName, ReportedGrade> {
  pass: boolean;
  metrics: Record<string, number | boolean | null>;
}

export interface Report {
  version: 1;
  kit: { version: string };
  pass: boolean;
  screens: Record<string, ScreenReport>;
}

export interface CliIO {
  stdout(text: string): void;
  stderr(text: string): void;
}

export interface CliOptions {
  io?: CliIO;
  /** Tests swap the compiler out; the bin uses a real `Typechecker`. */
  typechecker?: Pick<Typechecker, 'prepare' | 'check' | 'dispose'>;
  catalog?: Catalog;
}

class UsageError extends Error {}

const EMPTY: Expect = { recipes: [], states: [] };

const processIO: CliIO = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

export async function main(argv: string[], options: CliOptions = {}): Promise<number> {
  const io = options.io ?? processIO;
  let parsed: Args;
  let screens: Screen[];
  let expectFor: (name: string) => Expect;
  try {
    parsed = parseArgs(argv);
    if (parsed.help) {
      io.stdout(`${USAGE}\n`);
      return 0;
    }
    screens = collectScreens(parsed.paths);
    expectFor = parsed.expect === null ? () => EMPTY : loadExpect(parsed.expect, screens, io);
  } catch (error) {
    io.stderr(`fluxnative-ui-grade: ${(error as Error).message}\n`);
    if (error instanceof UsageError) io.stderr(`${USAGE}\n`);
    return 1;
  }

  const typechecker = options.typechecker ?? new Typechecker();
  try {
    const catalog = options.catalog ?? loadCatalog();
    let unavailable: string | null = null;
    try {
      typechecker.prepare();
    } catch (error) {
      unavailable = (error as Error).message;
    }

    const report: Report = { version: 1, kit: { version: kitVersion() }, pass: true, screens: {} };
    for (const screen of screens) {
      const graded = gradeOne(screen, expectFor(screen.name), typechecker, catalog, unavailable);
      if (graded.unavailable !== null) unavailable ??= graded.unavailable;
      report.screens[screen.name] = graded.report;
      if (!graded.report.pass) report.pass = false;
    }

    if (parsed.json) io.stdout(`${JSON.stringify(report, null, 2)}\n`);
    else io.stdout(formatText(report));
    if (unavailable !== null) {
      io.stderr(`fluxnative-ui-grade: typecheck unavailable: ${unavailable}\n`);
      return 1;
    }
    return report.pass ? 0 : 2;
  } catch (error) {
    io.stderr(`fluxnative-ui-grade: ${(error as Error).message}\n`);
    return 1;
  } finally {
    typechecker.dispose();
  }
}

interface Args {
  help: boolean;
  json: boolean;
  expect: string | null;
  paths: string[];
}

function parseArgs(argv: string[]): Args {
  const args: Args = { help: false, json: false, expect: null, paths: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === '--') {
      args.paths.push(...argv.slice(i + 1));
      break;
    }
    if (arg === '-h' || arg === '--help') args.help = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--expect' || arg.startsWith('--expect=')) {
      const value = arg === '--expect' ? argv[++i] : arg.slice('--expect='.length);
      if (value === undefined || value === '') throw new UsageError('--expect needs a JSON file');
      if (args.expect !== null) throw new UsageError('--expect given twice');
      args.expect = value;
    } else if (arg.startsWith('-')) throw new UsageError(`unknown option ${arg}`);
    else args.paths.push(arg);
  }
  if (!args.help && args.paths.length === 0) throw new UsageError('no screen given');
  return args;
}

interface Screen {
  name: string;
  file: string;
}

function collectScreens(paths: string[]): Screen[] {
  const screens: Screen[] = [];
  const seen = new Map<string, string>();
  const add = (file: string) => {
    const name = basename(file, '.tsx');
    const other = seen.get(name);
    if (other !== undefined) throw new UsageError(`two screens named ${name}: ${other} and ${file}`);
    seen.set(name, file);
    screens.push({ name, file });
  };
  for (const path of paths) {
    if (!existsSync(path)) throw new UsageError(`no such file or directory: ${path}`);
    if (statSync(path).isDirectory()) {
      const files = readdirSync(path, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.tsx'))
        .map((entry) => entry.name)
        .sort();
      if (files.length === 0) throw new UsageError(`no .tsx screen directly in ${path}`);
      for (const file of files) add(join(path, file));
    } else if (path.endsWith('.tsx')) add(path);
    else throw new UsageError(`not a .tsx screen or a directory: ${path}`);
  }
  return screens;
}

function loadExpect(file: string, screens: Screen[], io: CliIO): (name: string) => Expect {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new UsageError(`--expect ${file}: ${(error as Error).message}`);
  }
  if (!isObject(raw)) throw new UsageError(`--expect ${file}: expected a JSON object`);
  if ('screens' in raw || 'default' in raw) {
    checkKeys(raw, ['screens', 'default'], file);
    const fallback = raw.default === undefined ? EMPTY : toExpect(raw.default, `${file}: default`);
    const perScreen = new Map<string, Expect>();
    if (raw.screens !== undefined) {
      if (!isObject(raw.screens)) throw new UsageError(`--expect ${file}: "screens" must be an object keyed by screen name`);
      for (const [name, value] of Object.entries(raw.screens)) perScreen.set(name, toExpect(value, `${file}: screens.${name}`));
    }
    const graded = new Set(screens.map((s) => s.name));
    for (const name of perScreen.keys()) {
      if (!graded.has(name)) io.stderr(`fluxnative-ui-grade: --expect names ${name}, which is not among the screens graded\n`);
    }
    return (name) => perScreen.get(name) ?? fallback;
  }
  const all = toExpect(raw, file);
  return () => all;
}

function toExpect(value: unknown, where: string): Expect {
  if (!isObject(value)) throw new UsageError(`--expect ${where}: expected { "recipes": [...], "states": [...] }`);
  checkKeys(value, ['recipes', 'states'], where);
  return { recipes: strings(value.recipes, `${where}.recipes`), states: strings(value.states, `${where}.states`) };
}

function strings(value: unknown, where: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) throw new UsageError(`--expect ${where}: expected an array of strings`);
  return value;
}

function checkKeys(value: Record<string, unknown>, allowed: string[], where: string): void {
  const unknown = Object.keys(value).filter((k) => !allowed.includes(k));
  if (unknown.length > 0) throw new UsageError(`--expect ${where}: unknown key ${unknown.map((k) => `"${k}"`).join(', ')} (allowed: ${allowed.join(', ')})`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const PLACEHOLDER: GradeResult<TypecheckDetails> = { pass: false, score: 0, details: { errors: [], suppressions: [], ms: 0 } };

function gradeOne(
  screen: Screen,
  expect: Expect,
  typechecker: Pick<Typechecker, 'check'>,
  catalog: Catalog,
  unavailableBefore: string | null,
): { report: ScreenReport; unavailable: string | null } {
  const code = readFileSync(screen.file, 'utf8');
  let unavailable = unavailableBefore;
  // A checker that cannot run leaves a placeholder that is replaced below, so the other graders still report.
  const guarded: Pick<Typechecker, 'check'> = {
    check: (source, name) => {
      if (unavailable !== null) return PLACEHOLDER;
      try {
        return typechecker.check(source, name);
      } catch (error) {
        unavailable = (error as Error).message;
        return PLACEHOLDER;
      }
    },
  };
  const g: ScreenGrades = gradeScreen(code, { screenName: screen.name, expect }, guarded, catalog);
  const metrics: Record<string, number | boolean | null> = { ...g.metrics };
  const typecheck: ReportedGrade = unavailable === null ? g.typecheck : { pass: false, score: 0, details: `unavailable: ${unavailable}` };
  if (unavailable !== null) metrics.typecheckErrors = null;
  let coverage: ReportedGrade = g.coverage;
  if (expect.recipes.length === 0 && expect.states.length === 0) {
    coverage = { pass: null, score: null, details: `na: no expected recipes or states for ${screen.name} (pass --expect)` };
    metrics.coverage = null;
    metrics.stateCoverage = null;
  }
  const grades: Record<GraderName, ReportedGrade> = {
    dialect: g.dialect,
    typecheck,
    props: g.props,
    tokens: g.tokens,
    shadowPrimitive: g.shadowPrimitive,
    coverage,
  };
  const pass = GRADERS.every((name) => grades[name].pass !== false);
  return { report: { pass, ...grades, metrics }, unavailable };
}

function kitVersion(): string {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version?: unknown };
  return typeof pkg.version === 'string' ? pkg.version : 'unknown';
}

function formatText(report: Report): string {
  const lines: string[] = [];
  let passing = 0;
  let na = 0;
  for (const [name, screen] of Object.entries(report.screens)) {
    if (screen.coverage.pass === null) na++;
    if (screen.pass) {
      passing++;
      lines.push(`ok   ${name}`);
      continue;
    }
    for (const grader of GRADERS) {
      if (screen[grader].pass === false) lines.push(`FAIL ${name} ${grader}: ${summarize(grader, screen[grader].details)}`);
    }
  }
  const total = Object.keys(report.screens).length;
  const note = na > 0 ? `; coverage not graded for ${na} (no --expect entry)` : '';
  lines.push(`${report.pass ? 'pass' : 'fail'}: ${passing}/${total} screens pass every grader${note}`);
  return `${lines.join('\n')}\n`;
}

const MAX_LISTED = 3;

function summarize(grader: GraderName, details: unknown): string {
  if (typeof details === 'string') return details;
  const d = details as Record<string, unknown>;
  const list = (items: unknown, show: (item: Record<string, unknown>) => string): string => {
    const all = Array.isArray(items) ? (items as Record<string, unknown>[]) : [];
    const shown = all.slice(0, MAX_LISTED).map(show);
    if (all.length > MAX_LISTED) shown.push(`… ${all.length - MAX_LISTED} more`);
    return `${all.length} finding${all.length === 1 ? '' : 's'}: ${shown.join('; ')}`;
  };
  const oneLine = (text: unknown) => String(text).replace(/\s+/g, ' ').trim();
  switch (grader) {
    case 'dialect':
      return list(d.violations, (v) => `line ${v.line} ${oneLine(v.message)}`);
    case 'typecheck': {
      const errors = list(d.errors, (e) => `${e.file ?? '(global)'}${e.line === null ? '' : `:${e.line}`} TS${e.code} ${oneLine(e.message)}`);
      const suppressions = Array.isArray(d.suppressions) && d.suppressions.length > 0 ? `; suppressions: ${d.suppressions.join(', ')}` : '';
      return `${errors}${suppressions}`;
    }
    case 'props':
      return list(d.hallucinated, (h) => `<${h.component}> has no prop \`${h.prop}\` (line ${h.line})`);
    case 'tokens':
      return list(d.violations, (v) => `${v.rule} \`${oneLine(v.text)}\` (line ${v.line})`);
    case 'shadowPrimitive':
      return list(d.findings, (f) => `line ${f.line} ${oneLine(f.message)}`);
    case 'coverage': {
      const missing = Array.isArray(d.missing) ? d.missing.join(', ') : '';
      return `share ${Number(d.share).toFixed(2)} below the bar; missing: ${missing}`;
    }
  }
}
