// Colour from a seed: the accent roles a brand does not set, derived from one
// brand colour so they stay readable on every surface they are drawn on. The
// method is the FluxNative builder's (templates/base/src/theme/colors.ts,
// `readableAccent`): keep the hue and move it toward black (light) or white
// (dark) just far enough. Checked against the page alone, about half of all
// brands failed on a card, a sheet or a sunken field; in the builder's dark
// scheme 157 of 324 seeds did (QA iteration 50).

export type Scheme = 'light' | 'dark';

/** The surfaces an accent is drawn on (those of the page's polarity; see `deriveSeedRoles`). */
export const SEED_SURFACES = ['background', 'card', 'popover', 'muted'] as const;

/** The roles a seed derives, when the brand does not set them. Neutrals, status colours, borders and glass stay the kit's or the brand's. */
export const SEED_ROLES = ['primary', 'primary-foreground', 'ring', 'tertiary', 'tertiary-foreground', 'accent', 'accent-foreground'] as const;

/** Text and small graphics on a surface (WCAG 2.2 AA, 1.4.3). */
export const READABLE = 4.5;

/** Degrees the tertiary accent sits from the brand hue: close enough to read as family, far enough to tell apart. */
const TERTIARY_HUE_STEP = 40;

type Rgb = [number, number, number];

const HEX = /^#([0-9a-f]{6})$/i;

/** `#rrggbb` (or `#rgb`, or `rgb()`/`rgba()` composited over the scheme's canvas) as 0–255 channels. */
function parse(css: string, scheme: Scheme): Rgb {
  const value = css.trim();
  if (value.toLowerCase() === 'transparent') return scheme === 'dark' ? [0, 0, 0] : [255, 255, 255];
  const withAlpha = /^#([0-9a-f]{6})([0-9a-f]{2})$/i.exec(value);
  if (withAlpha) {
    const a = parseInt(withAlpha[2]!, 16) / 255;
    const canvas = scheme === 'dark' ? 0 : 255;
    return [0, 2, 4].map((i) => parseInt(withAlpha[1]!.slice(i, i + 2), 16) * a + canvas * (1 - a)) as Rgb;
  }
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value);
  if (short) return [1, 2, 3].map((i) => parseInt(short[i]! + short[i]!, 16)) as Rgb;
  const long = HEX.exec(value);
  if (long) return [0, 2, 4].map((i) => parseInt(long[1]!.slice(i, i + 2), 16)) as Rgb;
  const fn = /^rgba?\(([^)]+)\)$/i.exec(value);
  if (fn) {
    const [r = 0, g = 0, b = 0, a = 1] = fn[1]!.split(',').map((part) => Number.parseFloat(part));
    const canvas = scheme === 'dark' ? 0 : 255;
    return [r, g, b].map((c) => c * a + canvas * (1 - a)) as Rgb;
  }
  throw new Error(`not a colour: ${css}`);
}

function hex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')}`;
}

/** `a` moved toward `b` by `amount` (0 = a, 1 = b), in sRGB like the builder. */
export function mix(a: string, b: string, amount: number, scheme: Scheme = 'light'): string {
  const x = parse(a, scheme);
  const y = parse(b, scheme);
  return hex([0, 1, 2].map((i) => x[i]! + (y[i]! - x[i]!) * amount) as Rgb);
}

function luminance(css: string, scheme: Scheme): number {
  const linear = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = parse(css, scheme);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function contrast(a: string, b: string, scheme: Scheme = 'light'): number {
  const [hi, lo] = [luminance(a, scheme), luminance(b, scheme)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

function rotateHue(css: string, degrees: number): string {
  const [r, g, b] = parse(css, 'light').map((c) => c / 255) as Rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return hex([r * 255, g * 255, b * 255]);
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (((h * 60 + degrees) % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return hex([(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255]);
}

/** The hue of `color`, moved toward black (light) or white (dark) just far enough to reach `min` on every surface. */
export function readableAccent(color: string, surfaces: readonly string[], scheme: Scheme, min = READABLE): string {
  const readable = (candidate: string) => surfaces.every((surface) => contrast(candidate, surface, scheme) >= min);
  if (readable(color)) return hex(parse(color, scheme));
  const target = scheme === 'dark' ? '#ffffff' : '#000000';
  for (let step = 1; step <= 40; step += 1) {
    const candidate = mix(color, target, step / 40, scheme);
    if (readable(candidate)) return candidate;
  }
  return target;
}

/** White or near-black, whichever reads better on `background`. */
export function readableOn(background: string, scheme: Scheme): string {
  return contrast('#ffffff', background, scheme) >= contrast('#0a0a0b', background, scheme) ? '#ffffff' : '#0a0a0b';
}

/**
 * The seed roles for one scheme. `palette` is the scheme's palette as the brand
 * leaves it (kit roles with the brand's on top), so a brand that sets its own
 * surfaces gets accents readable on those surfaces. Roles in `keep` (the ones
 * the brand set) are not returned: a colour the brand chose is used as written.
 */
export function deriveSeedRoles(seed: string, palette: Record<string, string>, scheme: Scheme, keep: ReadonlySet<string> = new Set()): Record<string, string> {
  if (!HEX.test(seed.trim())) throw new Error(`seed must be a #rrggbb colour (got ${JSON.stringify(seed)})`);
  const background = palette.background ?? (scheme === 'dark' ? '#000000' : '#ffffff');
  // The surfaces that take the page's ink. A card of the opposite polarity (a dark card on a light page) is
  // an inverse surface with its own foreground: no colour reads on both, so the accent is not held to it.
  const ink = readableOn(background, scheme);
  const surfaces = SEED_SURFACES.map((role) => palette[role])
    .filter((c): c is string => typeof c === 'string' && c.trim() !== '')
    .filter((c) => readableOn(c, scheme) === ink);
  const pick = (role: string, derived: () => string) => (keep.has(role) ? palette[role]! : derived());

  const primary = pick('primary', () => readableAccent(seed, surfaces, scheme));
  const tertiary = pick('tertiary', () => readableAccent(rotateHue(seed, TERTIARY_HUE_STEP), surfaces, scheme));
  // A tinted container for the current item (a tab's lens, a badge circle): the accent faded into the page.
  const accent = pick('accent', () => mix(primary, background, scheme === 'dark' ? 0.72 : 0.86, scheme));

  const derived: Record<string, string> = {
    primary,
    'primary-foreground': pick('primary-foreground', () => readableOn(primary, scheme)),
    ring: pick('ring', () => primary),
    tertiary,
    'tertiary-foreground': pick('tertiary-foreground', () => readableOn(tertiary, scheme)),
    accent,
    // Ink on the container in the seed's hue, readable on it.
    'accent-foreground': pick('accent-foreground', () => readableAccent(seed, [accent], scheme)),
  };
  for (const role of keep) delete derived[role];
  return derived;
}
