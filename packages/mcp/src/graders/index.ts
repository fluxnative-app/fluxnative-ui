// Runs every grader on one model reply and derives pass@1:
//   extract && dialect && typecheck && hallucinated props == 0 && token violations == 0
// shadow-primitive and coverage are reported but don't gate pass@1.

import { loadCatalog, type Catalog } from './catalog.ts';
import { gradeCoverage, type CoverageDetails, type Expect } from './coverage.ts';
import { gradeDialect, type DialectDetails } from './dialect.ts';
import { extract, type ExtractDetails } from './extract.ts';
import { gradeProps, type PropsDetails } from './props.ts';
import { gradeShadowPrimitive, type ShadowDetails } from './shadow-primitive.ts';
import { SCREEN_DIR, parseScreen } from './source.ts';
import { gradeTokens, type TokensDetails } from './tokens.ts';
import type { TypecheckDetails, Typechecker } from './typecheck.ts';
import type { GradeResult, Skipped } from './types.ts';

export type { Expect } from './coverage.ts';
export { Typechecker } from './typecheck.ts';

/** Flat numbers the report aggregates, so it never digs through details. */
export interface Metrics {
  /** False when the reply had nothing to grade; count metrics then skip the sample. */
  hasCode: boolean;
  typecheckErrors: number;
  dialectViolations: number;
  catalogElements: number;
  hallucinatedProps: number;
  tokenViolations: number;
  shadowFindings: number;
  coverage: number;
  stateCoverage: number;
}

export interface Grades {
  extract: GradeResult<ExtractDetails>;
  dialect: GradeResult<DialectDetails | Skipped>;
  typecheck: GradeResult<TypecheckDetails | Skipped>;
  props: GradeResult<PropsDetails | Skipped>;
  tokens: GradeResult<TokensDetails | Skipped>;
  shadowPrimitive: GradeResult<ShadowDetails | Skipped>;
  coverage: GradeResult<CoverageDetails | Skipped>;
  pass1: boolean;
  metrics: Metrics;
}

export interface GradeTarget {
  /** Component and file name: the screen is checked as `screens/<screenName>.tsx`. */
  screenName: string;
  expect: Expect;
}

export function gradeOutput(output: string, target: GradeTarget, typechecker: Pick<Typechecker, 'check'>, catalog: Catalog = loadCatalog()): Grades {
  const extracted = extract(output);
  const { code, ...extractGrade } = extracted;
  if (code === null) {
    const skipped: GradeResult<Skipped> = { pass: false, score: 0, details: { skipped: extracted.details.reason ?? 'no code' } };
    return {
      extract: extractGrade,
      dialect: skipped,
      typecheck: skipped,
      props: skipped,
      tokens: skipped,
      shadowPrimitive: skipped,
      coverage: skipped,
      pass1: false,
      metrics: {
        hasCode: false,
        typecheckErrors: 0,
        dialectViolations: 0,
        catalogElements: 0,
        hallucinatedProps: 0,
        tokenViolations: 0,
        shadowFindings: 0,
        coverage: 0,
        stateCoverage: 0,
      },
    };
  }

  const graded = gradeScreen(code, target, typechecker, catalog);
  return {
    extract: extractGrade,
    ...graded,
    pass1:
      extractGrade.pass &&
      graded.dialect.pass &&
      graded.typecheck.pass &&
      graded.props.details.hallucinated.length === 0 &&
      graded.tokens.details.violations.length === 0,
  };
}

/** Every grader but extract, on screen source (a `.tsx` file, not a model reply). */
export interface ScreenGrades {
  dialect: GradeResult<DialectDetails>;
  typecheck: GradeResult<TypecheckDetails>;
  props: GradeResult<PropsDetails>;
  tokens: GradeResult<TokensDetails>;
  shadowPrimitive: GradeResult<ShadowDetails>;
  coverage: GradeResult<CoverageDetails>;
  metrics: Metrics;
}

export function gradeScreen(code: string, target: GradeTarget, typechecker: Pick<Typechecker, 'check'>, catalog: Catalog = loadCatalog()): ScreenGrades {
  const screen = parseScreen(code);
  const dialect = gradeDialect(screen, catalog, `${SCREEN_DIR}/${target.screenName}.tsx`);
  const typecheck = typechecker.check(code, target.screenName);
  const props = gradeProps(screen, catalog);
  const tokens = gradeTokens(screen);
  const shadowPrimitive = gradeShadowPrimitive(screen);
  const coverage = gradeCoverage(screen, catalog, target.expect);
  return {
    dialect,
    typecheck,
    props,
    tokens,
    shadowPrimitive,
    coverage,
    metrics: {
      hasCode: true,
      typecheckErrors: typecheck.details.errors.length + typecheck.details.suppressions.length,
      dialectViolations: dialect.details.violations.length,
      catalogElements: props.details.elements,
      hallucinatedProps: props.details.hallucinated.length,
      tokenViolations: tokens.details.violations.length,
      shadowFindings: shadowPrimitive.details.findings.length,
      coverage: coverage.details.share,
      stateCoverage: coverage.details.states.share,
    },
  };
}
