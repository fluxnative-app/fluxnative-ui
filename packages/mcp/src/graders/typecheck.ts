// typecheck: the screen compiled the way a template is, against the real
// catalog layer. One scaffold per process: `fluxnative-catalog emit --to
// <tmp>/files`, `<tmp>/node_modules` linked to packages/catalog/node_modules
// (react, react-native, react-native-svg and their types), and the compiler
// options of packages/catalog/tsconfig.files.json. Each sample is written to
// `<tmp>/files/screens/<Name>.tsx` and checked like `tsc -p` would; parsed
// library files are cached across samples, so a check costs tens of ms.

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import ts from 'typescript';
import { FLUX_GLASS_STUB, FLUX_INDEX, FLUX_NAVIGATION, HOST_STUBS } from './host.ts';
import { CATALOG_CLI, CATALOG_DIR, CATALOG_NODE_MODULES, CATALOG_TSCONFIG, HOST_GLASS } from './paths.ts';
import { SCREEN_DIR } from './source.ts';
import { countScore, type GradeResult } from './types.ts';

export interface TypecheckDiagnostic {
  code: number;
  /** Relative to the template's `files/`; null for global diagnostics. */
  file: string | null;
  line: number | null;
  message: string;
}

export interface TypecheckDetails {
  errors: TypecheckDiagnostic[];
  /** Template mode only: errors in the template's other files the screen pulls in. Reported, never charged to the screen. */
  elsewhere?: TypecheckDiagnostic[];
  /** `@ts-nocheck` / `@ts-ignore` / `@ts-expect-error`: a screen may not switch the checker off. */
  suppressions: string[];
  ms: number;
}

const SUPPRESSION_RE = /@ts-(?:nocheck|ignore|expect-error)\b/g;
const MAX_MESSAGE = 400;
const HOST_STUBS_FILE = 'host-stubs.d.ts';

export interface TypecheckerOptions {
  /**
   * Template mode: a Flux template's `files/` folder. The screen compiles as
   * part of that template (its own components, data and theme resolvable),
   * against the kit's React and React Native types and the host modules of
   * `./host.ts`, with the host's options (unused locals allowed). Without it
   * the screen compiles against a freshly emitted catalog layer.
   */
  root?: string;
}

export class Typechecker {
  #dir: string | null = null;
  #options: ts.CompilerOptions | null = null;
  readonly #cache = new Map<string, ts.SourceFile>();
  readonly #root: string | null;

  constructor(options: TypecheckerOptions = {}) {
    this.#root = options.root ?? null;
  }

  /** The scaffold's `files/` folder (created on first use). */
  get filesDir(): string {
    return join(this.#scaffold(), 'files');
  }

  /** Builds the scaffold and reads the compiler options now, so a setup problem surfaces before any API call. */
  prepare(): void {
    this.#scaffold();
    this.#compilerOptions();
  }

  /** `file` is the screen's path inside `files/`; in template mode, its path inside the root. */
  check(code: string, screenName: string, file = `${SCREEN_DIR}/${screenName}.tsx`): GradeResult<TypecheckDetails> {
    const started = performance.now();
    const filesDir = this.filesDir;
    const options = this.#compilerOptions();
    const screenFile = join(filesDir, file);
    const template = this.#root !== null;
    // A template's screen is already in the copy: rewriting it with the graded source keeps the two in step.
    const original = template && existsSync(screenFile) ? readFileSync(screenFile, 'utf8') : null;
    mkdirSync(dirname(screenFile), { recursive: true });
    writeFileSync(screenFile, code);
    try {
      const rootNames = template ? [join(this.#scaffold(), HOST_STUBS_FILE), screenFile] : [screenFile];
      const program = ts.createProgram({ rootNames, options, host: this.#host(options, filesDir) });
      const sf = program.getSourceFile(screenFile);
      // The order and short-circuits of `tsc` (emitFilesAndReportErrors).
      let diagnostics: readonly ts.Diagnostic[] = [...program.getSyntacticDiagnostics(sf)];
      if (diagnostics.length === 0) {
        diagnostics = [...program.getOptionsDiagnostics(), ...program.getGlobalDiagnostics()];
        if (diagnostics.length === 0) diagnostics = program.getSemanticDiagnostics(sf);
        if (diagnostics.length === 0 && options.declaration) diagnostics = program.getDeclarationDiagnostics(sf);
      }
      const errors = diagnostics.filter((d) => d.category === ts.DiagnosticCategory.Error).map((d) => toDiagnostic(d, filesDir));
      const suppressions = [...code.matchAll(SUPPRESSION_RE)].map((m) => m[0]);
      const findings = errors.length + suppressions.length;
      const elsewhere = template ? this.#elsewhere(program, screenFile, filesDir) : undefined;
      return {
        pass: findings === 0,
        score: countScore(findings),
        details: { errors, ...(elsewhere === undefined ? {} : { elsewhere }), suppressions, ms: Math.round(performance.now() - started) },
      };
    } finally {
      if (original !== null) writeFileSync(screenFile, original);
      else if (!template) unlinkSync(screenFile);
    }
  }

  /** Errors in the template's own files other than the screen (never the host modules or node_modules). */
  #elsewhere(program: ts.Program, screenFile: string, filesDir: string): TypecheckDiagnostic[] {
    const out: TypecheckDiagnostic[] = [];
    const inside = filesDir + sep;
    for (const sf of program.getSourceFiles()) {
      if (sf.fileName === screenFile || !sf.fileName.startsWith(inside) || sf.fileName.includes(`${sep}node_modules${sep}`)) continue;
      const diagnostics = [...program.getSyntacticDiagnostics(sf), ...program.getSemanticDiagnostics(sf)];
      for (const d of diagnostics) if (d.category === ts.DiagnosticCategory.Error) out.push(toDiagnostic(d, filesDir));
    }
    return out;
  }

  dispose(): void {
    if (this.#dir === null) return;
    this.#remove(this.#dir);
    this.#dir = null;
  }

  #scaffold(): string {
    if (this.#dir !== null) return this.#dir;
    if (this.#root !== null) return (this.#dir = this.#templateScaffold(this.#root));
    this.#requireDeps();
    const dir = mkdtempSync(join(tmpdir(), 'fluxnative-eval-'));
    try {
      execFileSync(process.execPath, [CATALOG_CLI, 'emit', '--to', join(dir, 'files')], { stdio: 'pipe' });
      symlinkSync(CATALOG_NODE_MODULES, join(dir, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    } catch (error) {
      rmSync(dir, { recursive: true, force: true });
      throw new Error(`typecheck: could not scaffold the catalog layer (run \`pnpm install\` first?): ${(error as Error).message}`);
    }
    this.#dir = dir;
    return dir;
  }

  /**
   * `<tmp>/files`: a copy of the template (bare imports resolve by walking up
   * from the importing file, so it is never checked in place); `<tmp>/
   * node_modules`: links to the kit's react, react-native and types plus a
   * `flux` package with the host's declarations; `<tmp>/host-stubs.d.ts`.
   */
  #templateScaffold(root: string): string {
    if (!existsSync(join(root, SCREEN_DIR)) && !existsSync(join(root, 'App.tsx'))) {
      throw new Error(`typecheck: ${root} has neither App.tsx nor screens/; --root takes a template's files/ folder`);
    }
    this.#requireDeps();
    const dir = mkdtempSync(join(tmpdir(), 'fluxnative-grade-'));
    try {
      cpSync(root, join(dir, 'files'), { recursive: true, filter: (src) => !src.split(sep).includes('node_modules') });
      const modules = join(dir, 'node_modules');
      mkdirSync(modules);
      for (const entry of readdirSync(CATALOG_NODE_MODULES)) {
        if (entry === '.bin' || entry === 'flux') continue;
        symlinkSync(join(CATALOG_NODE_MODULES, entry), join(modules, entry), process.platform === 'win32' ? 'junction' : 'dir');
      }
      const flux = join(modules, 'flux');
      mkdirSync(flux);
      writeFileSync(join(flux, 'package.json'), '{ "name": "flux", "private": true, "types": "index.d.ts" }\n');
      writeFileSync(join(flux, 'index.d.ts'), FLUX_INDEX);
      writeFileSync(join(flux, 'navigation.d.ts'), FLUX_NAVIGATION);
      const glass = existsSync(HOST_GLASS);
      if (glass) writeFileSync(join(flux, 'glass.tsx'), readFileSync(HOST_GLASS, 'utf8'));
      writeFileSync(join(dir, HOST_STUBS_FILE), glass ? HOST_STUBS : HOST_STUBS + FLUX_GLASS_STUB);
    } catch (error) {
      this.#remove(dir);
      throw new Error(`typecheck: could not copy the template ${root}: ${(error as Error).message}`);
    }
    return dir;
  }

  #requireDeps(): void {
    // Without these the screen would resolve nothing and every check would be noise, never a pass.
    for (const dep of ['react', 'react-native']) {
      if (!existsSync(join(CATALOG_NODE_MODULES, dep, 'package.json'))) {
        throw new Error(`typecheck: ${dep} is not installed under ${CATALOG_NODE_MODULES} (run \`pnpm install\` first?)`);
      }
    }
  }

  #remove(dir: string): void {
    const modules = join(dir, 'node_modules');
    try {
      if (lstatSync(modules).isSymbolicLink()) unlinkSync(modules); // the link, never what it points at
      else for (const entry of readdirSync(modules)) if (lstatSync(join(modules, entry)).isSymbolicLink()) unlinkSync(join(modules, entry));
    } catch {
      // already gone
    }
    rmSync(dir, { recursive: true, force: true });
  }

  #compilerOptions(): ts.CompilerOptions {
    if (this.#options !== null) return this.#options;
    const read = ts.readConfigFile(CATALOG_TSCONFIG, ts.sys.readFile);
    if (read.error) throw new Error(`typecheck: ${ts.flattenDiagnosticMessageText(read.error.messageText, '\n')}`);
    const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, CATALOG_DIR, undefined, CATALOG_TSCONFIG);
    const options: ts.CompilerOptions = { ...parsed.options, noEmit: true };
    delete options.configFilePath;
    if (this.#root !== null) {
      // The hosts' options (fluxbuilder-template's typecheck_templates.py): unused locals are the kit's own rule.
      Object.assign(options, { noUnusedLocals: false, noUnusedParameters: false, allowImportingTsExtensions: true, skipLibCheck: true });
    }
    this.#options = options;
    return options;
  }

  /** A compiler host that re-parses only the screen; library and catalog files are parsed once per process. */
  #host(options: ts.CompilerOptions, filesDir: string): ts.CompilerHost {
    const host = ts.createCompilerHost(options, true);
    const screens = join(filesDir, SCREEN_DIR);
    const getSourceFile = host.getSourceFile.bind(host);
    host.getSourceFile = (fileName, languageVersion, onError, shouldCreate) => {
      if (fileName.startsWith(screens)) return getSourceFile(fileName, languageVersion, onError, shouldCreate);
      const hit = this.#cache.get(fileName);
      if (hit !== undefined) return hit;
      const sf = getSourceFile(fileName, languageVersion, onError, shouldCreate);
      if (sf !== undefined) this.#cache.set(fileName, sf);
      return sf;
    };
    return host;
  }
}

function toDiagnostic(d: ts.Diagnostic, filesDir: string): TypecheckDiagnostic {
  let message = ts.flattenDiagnosticMessageText(d.messageText, '\n');
  if (message.length > MAX_MESSAGE) message = `${message.slice(0, MAX_MESSAGE)}…`;
  if (d.file === undefined) return { code: d.code, file: null, line: null, message };
  const line = d.start === undefined ? null : d.file.getLineAndCharacterOfPosition(d.start).line + 1;
  return { code: d.code, file: relative(filesDir, d.file.fileName).split('\\').join('/'), line, message };
}
