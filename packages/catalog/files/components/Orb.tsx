// The assistant's orb: the mark of a voice or AI moment. `state` sets the
// motion (idle breathes, listening and speaking swell with `level`, thinking
// spins an arc, error shakes once in the error tone, disabled is muted);
// `level` (0–1, from the voice hook) drives the swell, a negative one keeps
// a procedural breathing. Two looks: `glass` (a glossy sphere in a turning
// aura) and `pulse` (a core that emits rings). SVG layers in Animated views,
// one native-driver clock; under Reduce Motion or `paused` it is one still
// frame and starts no animation. Colours are theme roles, so a brand's
// palette carries through.
//
// Adapted from voiceorbs glass-orb and pulse-orb, https://github.com/amunozdev/voiceorbs
// (the CSS layers redrawn in react-native-svg: blur as soft gradient stops,
// conic gradients as rotated blobs and arc segments; backdrop-filter, grain
// and mask compositing are not drawn). The original's notice:
//
// MIT License
//
// Copyright (c) 2026 Alexis Munoz
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { usePalette, useScheme, type ColorScheme, type Palette } from '../theme/usePalette';
import useReducedMotion from './useReducedMotion';

export type OrbVariant = 'glass' | 'pulse';
export type OrbState = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error' | 'disabled';
/** A hue role of the palette the orb is painted from. */
export type OrbColor = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'inverse';

export interface OrbProps {
  /** 'glass' (default): a glossy sphere in a turning aura; 'pulse': a core that emits rings. */
  variant?: OrbVariant;
  /** Diameter in px. Default 160. */
  size?: number;
  /** First hue. Default 'primary'. */
  from?: OrbColor;
  /** Second hue. Default 'tertiary' (the AI tone `AiBadge` uses). */
  to?: OrbColor;
  /** Default 'idle'. 'error' uses `destructive`; 'disabled' is greyed. */
  state?: OrbState;
  /** Voice level 0–1 (clamped, smoothed). Negative or unset: a procedural level per state. */
  level?: number;
  /** Motion speed, 1 = normal (0.25–4). */
  speed?: number;
  /** One still frame, as under Reduce Motion. */
  paused?: boolean;
  /** Default from `state` ('Assistant listening'…). */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

type N = number | Animated.AnimatedInterpolation<number>;
type D = string | Animated.AnimatedInterpolation<string>;
interface Track {
  inputRange: number[];
  outputRange: number[];
}
type Rgb = readonly [number, number, number];
/** A colour and its alpha, kept apart for SVG `stopColor` / `stopOpacity`. */
interface Ink {
  c: string;
  a: number;
}

const LABELS: { readonly [S in OrbState]: string } = {
  idle: 'Assistant ready',
  connecting: 'Assistant connecting',
  listening: 'Assistant listening',
  thinking: 'Assistant thinking',
  speaking: 'Assistant speaking',
  error: 'Assistant error',
  disabled: 'Assistant unavailable',
};

/** The level a still frame shows when none is given (voiceorbs' reduced-motion table). */
const REST_LEVEL: { readonly [S in OrbState]: number } = {
  idle: 0,
  connecting: 0.22,
  listening: 0.7,
  thinking: 0.4,
  speaking: 0.55,
  error: 0.2,
  disabled: 0,
};

/** One clock turn, in ms at speed 1. Every loop is a whole number of cycles in it, so the turn is seamless. */
const PERIOD = 36000;
const TAU = Math.PI * 2;

export const clampOrbLevel = (level: number): number => (level > 1 ? 1 : level >= 0 ? level : 0);
const wave = (u: number) => 0.5 - 0.5 * Math.cos(TAU * u);
const easeOut = (u: number) => 1 - (1 - u) ** 3;

/** The procedural level over one clock turn (voiceorbs' `stateEnergy`, its fast waves slowed to whole cycles). */
function energy(state: OrbState, u: number): number {
  switch (state) {
    case 'listening':
      return 0.4 + 0.32 * wave(24 * u) + 0.18 * wave(10 * u + 0.48);
    case 'speaking':
      return 0.3 + 0.24 * wave(18 * u) + 0.16 * wave(8 * u + 0.19);
    case 'thinking':
      return 0.24 + 0.2 * wave(12 * u);
    case 'connecting':
      return 0.12 + 0.1 * wave(10 * u);
    default:
      return REST_LEVEL[state];
  }
}

function proceduralTrack(state: OrbState): Track {
  const steps = state === 'listening' || state === 'speaking' || state === 'thinking' || state === 'connecting' ? 240 : 1;
  const inputRange = Array.from({ length: steps + 1 }, (_, i) => i / steps);
  return { inputRange, outputRange: inputRange.map((u) => energy(state, u)) };
}

/**
 * `shape` (one cycle, u in 0–1) repeated `cycles` times over the clock turn,
 * shifted by `phase` (a share of a cycle), sampled for `interpolate`; a wrap
 * jumps within 1e-6 of the clock.
 */
export function track(cycles: number, shape: (u: number) => number, phase = 0, samples = 8): Track {
  const inputRange: number[] = [];
  const outputRange: number[] = [];
  const end = cycles + phase;
  let a = phase;
  while (a < end - 1e-4) {
    const b = Math.min(Math.floor(a) + 1, end);
    const base = Math.floor(a);
    for (let i = 0; i <= samples; i += 1) {
      const u = a + ((b - a) * i) / samples;
      const last = inputRange[inputRange.length - 1];
      const at = (u - phase) / cycles;
      inputRange.push(last !== undefined && at <= last ? last + 1e-6 : at);
      outputRange.push(shape(u - base));
    }
    a = b;
  }
  return { inputRange, outputRange };
}

// ---- colour --------------------------------------------------------------

function rgbOf(color: string): Rgb {
  const text = color.trim();
  const hex = /^#([0-9a-f]{3,8})$/i.exec(text)?.[1];
  if (hex !== undefined) {
    const full = hex.length < 6 ? hex.slice(0, 3).split('').map((c) => c + c).join('') : hex.slice(0, 6);
    const n = Number.parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const parts = (/^rgba?\(([^)]*)\)$/i.exec(text)?.[1] ?? '').split(/[\s,/]+/).filter(Boolean).map(Number.parseFloat);
  return [parts[0] ?? 128, parts[1] ?? 128, parts[2] ?? 128];
}

const hexOf = (rgb: Rgb) => `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;

/** `a` moved `t` of the way to `b` (sRGB; the CSS mixes in oklab). */
function mix(a: string, b: string, t: number): string {
  const x = rgbOf(a);
  const y = rgbOf(b);
  return hexOf([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

function grey(color: string, t: number): string {
  const [r, g, b] = rgbOf(color);
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return mix(color, hexOf([luma, luma, luma]), t);
}

interface Hues {
  from: string;
  to: string;
  blend: string;
}

function huesOf(palette: Palette, from: OrbColor, to: OrbColor, state: OrbState): Hues {
  let a = palette[from];
  let b = palette[to];
  if (state === 'error') {
    a = mix(palette.destructive, '#ffffff', 0.3);
    b = palette.destructive;
  } else if (state === 'disabled') {
    a = grey(a, 0.85);
    b = grey(b, 0.85);
  }
  a = hexOf(rgbOf(a));
  b = hexOf(rgbOf(b));
  return { from: a, to: b, blend: mix(a, b, 0.5) };
}

/** A gradient id shared by every orb drawn with the same colours (same id, same content: no clash on web). */
function idOf(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return `orb${h.toString(36)}`;
}

// ---- drawing helpers -----------------------------------------------------

const stops = (list: ReadonlyArray<readonly [number, Ink]>) =>
  list.map(([offset, ink]) => <Stop key={offset} offset={offset} stopColor={ink.c} stopOpacity={ink.a} />);

/** A soft blob: the colour at the centre fading out (what CSS `blur()` did to a hard edge). */
const soft = (id: string, ink: Ink) => (
  <RadialGradient id={id} cx="50%" cy="50%" r="50%">
    {stops([
      [0, ink],
      [0.45, { c: ink.c, a: ink.a * 0.7 }],
      [0.75, { c: ink.c, a: ink.a * 0.25 }],
      [1, { c: ink.c, a: 0 }],
    ])}
  </RadialGradient>
);

interface ConicStop {
  /** Degrees from the top, clockwise. */
  at: number;
  ink: Ink;
}

/** A conic gradient seen through a ring mask, as arc segments of a stroked circle. */
function conicRing(stopsList: ConicStop[], turn: number, radius: number, width: number, step = 5): React.ReactElement[] {
  const first = stopsList[0];
  const last = stopsList[stopsList.length - 1];
  if (first === undefined || last === undefined) return [];
  const point = (deg: number) => {
    const rad = ((deg + turn) * Math.PI) / 180;
    return `${(50 + radius * Math.sin(rad)).toFixed(2)} ${(50 - radius * Math.cos(rad)).toFixed(2)}`;
  };
  const inkAt = (deg: number): Ink => {
    for (let i = 1; i < stopsList.length; i += 1) {
      const lo = stopsList[i - 1];
      const hi = stopsList[i];
      if (lo !== undefined && hi !== undefined && deg <= hi.at) {
        const t = hi.at === lo.at ? 1 : (deg - lo.at) / (hi.at - lo.at);
        return { c: mix(lo.ink.c, hi.ink.c, t), a: lo.ink.a + (hi.ink.a - lo.ink.a) * t };
      }
    }
    return last.ink;
  };
  const out: React.ReactElement[] = [];
  for (let deg = first.at; deg < last.at; deg += step) {
    const to = Math.min(deg + step, last.at);
    const ink = inkAt((deg + to) / 2);
    if (ink.a < 0.01) continue;
    out.push(
      <Path
        key={deg}
        d={`M ${point(deg)} A ${radius} ${radius} 0 0 1 ${point(to)}`}
        stroke={ink.c}
        strokeOpacity={ink.a}
        strokeWidth={width}
        fill="none"
      />,
    );
  }
  return out;
}

const layer = (size: number, inset: number): ViewStyle => ({
  position: 'absolute',
  left: size * inset,
  top: size * inset,
  width: size * (1 - 2 * inset),
  height: size * (1 - 2 * inset),
});

const svg = (side: number, children: React.ReactNode) => (
  <Svg width={side} height={side} viewBox="0 0 100 100">
    {children}
  </Svg>
);

interface Motion {
  /** A rotation of `turns` per clock turn; `at` when still. */
  spin: (turns: number, at?: number) => D;
  /** A periodic value; `at` when still. */
  cycle: (cycles: number, shape: (u: number) => number, at: number, phase?: number, samples?: number) => N;
  /** `a + b × level`. */
  level: (a: number, b: number) => N;
}

function motionOf(still: boolean, clock: Animated.Value, smooth: Animated.Value, procedural: Track | null, rest: number): Motion {
  return {
    spin: (turns, at = 0) => (still ? `${at}deg` : clock.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${360 * turns}deg`] })),
    cycle: (cycles, shape, at, phase = 0, samples = 8) => (still ? at : clock.interpolate(track(cycles, shape, phase, samples))),
    level: (a, b) => {
      if (still) return a + b * rest;
      if (procedural !== null) return clock.interpolate({ inputRange: procedural.inputRange, outputRange: procedural.outputRange.map((l) => a + b * l) });
      return smooth.interpolate({ inputRange: [0, 1], outputRange: [a, a + b], extrapolate: 'clamp' });
    },
  };
}

interface Look {
  size: number;
  hues: Hues;
  scheme: ColorScheme;
  state: OrbState;
  m: Motion;
  still: boolean;
  id: string;
}

// ---- glass (glass-orb.module.css) ----------------------------------------

function glass({ size, hues, scheme, state, m, id }: Look): React.ReactNode {
  const { from, to, blend } = hues;
  const light = scheme === 'light';
  const fill: Ink = { c: blend, a: light ? 0.38 : 0.14 };
  const edge: Ink = light ? { c: mix(from, '#171a2b', 0.55), a: 0.65 } : { c: '#ffffff', a: 0.34 };
  const depth: Ink = light ? { c: mix(from, '#10131f', 0.42), a: 0.54 } : { c: mix(from, '#05060c', 0.52), a: 0.64 };
  const contact: Ink = light ? { c: mix(from, '#10131f', 0.55), a: 0.5 } : { c: mix(blend, '#000000', 0.4), a: 0.58 };
  const halo: Ink = light ? { c: blend, a: 0.68 } : { c: blend, a: 0.58 };
  const caustic: Ink = { c: mix(to, '#ffffff', 0.55), a: 0.72 };
  const counterSpec: Ink = { c: mix(to, '#ffffff', 0.42), a: 0.3 };
  const white = (a: number): Ink => ({ c: '#ffffff', a });

  const listening = state === 'listening';
  const speaking = state === 'speaking';
  const haloBase = listening ? 0.6 : 0.72;
  const haloGain = listening ? 0.4 : 0.28;
  const haloSwell = listening ? 0.2 : 0.14;
  const rimBase = speaking ? 0.7 : 0.85;
  const rimGain = speaking ? 0.45 : 0;
  const breathe = state === 'connecting' ? 0.035 : 0;

  // The aura's conic stops (from 20deg) as blobs around the centre.
  const aura: Array<[number, string]> = [
    [20, from],
    [85, mix(from, '#ff3ea5', 0.34)],
    [171, to],
    [250, mix(to, '#ffb54d', 0.3)],
    [315, mix(from, '#ffffff', 0.24)],
  ];
  const sphere = size * 0.8;
  const px = 100 / sphere; // one px in the sphere's 100 units
  const scale = size / 160; // the CSS was drawn at 160 px
  const ring = size * 0.94;
  const ringPx = 100 / ring;
  const orbitStops = (a: number): ConicStop[] => [
    { at: 0, ink: { c: mix(to, '#ffffff', 0.35), a: 0 } },
    { at: 14, ink: { c: mix(to, '#ffffff', 0.35), a } },
    { at: 46, ink: { c: mix(from, '#ffffff', 0.2), a } },
    { at: 60, ink: { c: mix(from, '#ffffff', 0.2), a: 0 } },
  ];
  const orbitRadius = 50 - 5 * scale * ringPx;
  const orbitWidth = 4 * scale * ringPx;

  return (
    <>
      <Animated.View key="halo" style={[layer(size, -0.08), { opacity: m.level(haloBase, haloGain), transform: [{ scale: m.level(1, haloSwell) }] }]}>
        {svg(
          size * 1.16,
          <>
            <Defs>
              <RadialGradient id={`${id}h`} cx="50%" cy="50%" r="50%">
                {stops(
                  light
                    ? [
                        [0.18, halo],
                        [0.42, { c: halo.c, a: halo.a * 0.45 }],
                        [0.66, { c: halo.c, a: 0 }],
                      ]
                    : [
                        [0.1, halo],
                        [0.5, { c: halo.c, a: halo.a * 0.5 }],
                        [0.96, { c: halo.c, a: 0 }],
                      ],
                )}
              </RadialGradient>
              <RadialGradient id={`${id}c`} cx="50%" cy="50%" r="50%">
                {stops([
                  [0, contact],
                  [1, { c: contact.c, a: 0 }],
                ])}
              </RadialGradient>
            </Defs>
            <Circle cx={50} cy={50} r={50} fill={`url(#${id}h)`} />
            <Ellipse cx={50} cy={80} rx={28} ry={9} fill={`url(#${id}c)`} />
          </>,
        )}
      </Animated.View>
      <Animated.View key="aura" style={[layer(size, 0.025), { opacity: m.level(0.62, 0.38), transform: [{ rotate: m.spin(4) }] }]}>
        {svg(
          size * 0.95,
          <>
            <Defs>
              {soft(`${id}a`, { c: blend, a: 0.55 })}
              {aura.map(([, c], i) => (
                <React.Fragment key={i}>{soft(`${id}a${i}`, { c, a: 0.95 })}</React.Fragment>
              ))}
            </Defs>
            <Circle cx={50} cy={50} r={48} fill={`url(#${id}a)`} />
            {aura.map(([deg], i) => {
              const rad = (deg * Math.PI) / 180;
              return <Circle key={i} cx={50 + 27 * Math.sin(rad)} cy={50 - 27 * Math.cos(rad)} r={23} fill={`url(#${id}a${i})`} />;
            })}
          </>,
        )}
      </Animated.View>
      <Animated.View key="sphere" style={[layer(size, 0.1), { transform: [{ scale: m.level(1, 0.045) }] }]}>
        <Animated.View
          style={{
            width: sphere,
            height: sphere,
            borderRadius: sphere / 2,
            overflow: 'hidden',
            transform: [{ scale: breathe > 0 ? m.cycle(11, (u) => 1 + breathe * wave(u), 1) : 1 }],
          }}
        >
          {svg(
            sphere,
            <>
              <Defs>
                <LinearGradient id={`${id}l`} x1="0.235" y1="0.076" x2="0.765" y2="0.924">
                  {stops([
                    [0, { c: from, a: 0.26 }],
                    [0.9, { c: to, a: 0.32 }],
                  ])}
                </LinearGradient>
                <RadialGradient id={`${id}d`} cx="50%" cy="50%" r="50%">
                  {stops([
                    [0, depth],
                    [0.74, { c: depth.c, a: 0 }],
                  ])}
                </RadialGradient>
                <RadialGradient id={`${id}k`} cx="50%" cy="50%" r="50%">
                  {stops([
                    [0, caustic],
                    [0.7, { c: caustic.c, a: 0 }],
                  ])}
                </RadialGradient>
                <RadialGradient id={`${id}t`} cx="50%" cy="53%" r="50%">
                  {stops([
                    [0.82, white(0)],
                    [1, white(0.32)],
                  ])}
                </RadialGradient>
                <RadialGradient id={`${id}b`} cx="50%" cy="40%" r="58%">
                  {stops([
                    [0.6, { c: depth.c, a: 0 }],
                    [1, depth],
                  ])}
                </RadialGradient>
              </Defs>
              <Circle cx={50} cy={50} r={50} fill={fill.c} fillOpacity={fill.a} />
              <Circle cx={50} cy={50} r={50} fill={`url(#${id}l)`} />
              <Ellipse cx={50} cy={112} rx={85} ry={60} fill={`url(#${id}d)`} />
              <Ellipse cx={50} cy={96} rx={60} ry={30} fill={`url(#${id}k)`} />
              <Circle cx={50} cy={50} r={50} fill={`url(#${id}t)`} />
              <Circle cx={50} cy={50} r={50} fill={`url(#${id}b)`} />
              <Circle cx={50} cy={50} r={50 - px / 2} stroke={edge.c} strokeOpacity={edge.a} strokeWidth={px} fill="none" />
            </>,
          )}
        </Animated.View>
      </Animated.View>
      <Animated.View key="sheen" style={[layer(size, 0.1), { opacity: 0.12, transform: [{ rotate: m.spin(3) }] }]}>
        {svg(
          sphere,
          <>
            <Defs>{soft(`${id}s`, white(0.85))}</Defs>
            <Circle cx={50 + 20 * Math.sin((142 * Math.PI) / 180)} cy={50 - 20 * Math.cos((142 * Math.PI) / 180)} r={26} fill={`url(#${id}s)`} />
            <Circle cx={50 + 20 * Math.sin((308 * Math.PI) / 180)} cy={50 - 20 * Math.cos((308 * Math.PI) / 180)} r={22} fill={`url(#${id}s)`} opacity={0.53} />
          </>,
        )}
      </Animated.View>
      <Animated.View key="rim" style={[layer(size, 0.1), { opacity: m.level(rimBase, rimGain) }]}>
        {svg(
          sphere,
          conicRing(
            [
              { at: 0, ink: white(0) },
              { at: 42, ink: white(0.9) },
              { at: 78, ink: { c: mix(to, '#ffffff', 0.55), a: 1 } },
              { at: 148, ink: { c: mix(to, '#ffffff', 0.55), a: 0 } },
              { at: 208, ink: { c: mix(from, '#ffffff', 0.45), a: 0.55 } },
              { at: 268, ink: { c: mix(from, '#ffffff', 0.45), a: 0 } },
            ],
            -70,
            50 - 3.25 * scale * px,
            3.5 * scale * px,
          ),
        )}
      </Animated.View>
      <Animated.View key="spec" style={[layer(size, 0.1), { opacity: m.cycle(3, (u) => 0.72 + 0.28 * wave(u), 1) }]}>
        {svg(
          sphere,
          <>
            <Defs>
              <RadialGradient id={`${id}p`} cx="50%" cy="50%" r="50%">
                {stops([
                  [0, white(0.95)],
                  [0.86, white(0.95)],
                  [0.94, white(0)],
                ])}
              </RadialGradient>
              <RadialGradient id={`${id}q`} cx="50%" cy="50%" r="50%">
                {stops([
                  [0, white(0.45)],
                  [0.74, white(0)],
                ])}
              </RadialGradient>
              <RadialGradient id={`${id}r`} cx="50%" cy="50%" r="50%">
                {stops([
                  [0, counterSpec],
                  [0.78, { c: counterSpec.c, a: 0 }],
                ])}
              </RadialGradient>
            </Defs>
            <Ellipse cx={33} cy={28} rx={20} ry={14} fill={`url(#${id}q)`} />
            <Ellipse cx={31} cy={25} rx={10} ry={7} fill={`url(#${id}p)`} />
            <Ellipse cx={69} cy={79} rx={15} ry={10} fill={`url(#${id}r)`} />
          </>,
        )}
      </Animated.View>
      {state === 'connecting' ? (
        <Animated.View key="orbit" style={[layer(size, 0.03), { opacity: 0.55, transform: [{ rotate: m.spin(-8) }] }]}>
          {svg(ring, conicRing(orbitStops(1), 0, orbitRadius, orbitWidth, 4))}
        </Animated.View>
      ) : null}
      {state === 'thinking' ? (
        <Animated.View key="counter" style={[layer(size, 0.03), { transform: [{ rotate: m.spin(-14, 180) }] }]}>
          {svg(ring, conicRing(orbitStops(1), 0, orbitRadius, orbitWidth, 4))}
        </Animated.View>
      ) : null}
    </>
  );
}

// ---- pulse (pulse-orb.module.css) ----------------------------------------

/** Cycles per clock turn of each ring per state (voiceorbs' 2.7 / 3.1 / 3.6 s × the set's time), and its still frame. */
const RINGS = {
  idle: { cycles: [7, 6, 5], set: 0.45, reverse: false },
  listening: { cycles: [15, 13, 11], set: 1, reverse: true },
  speaking: { cycles: [20, 17, 15], set: 1, reverse: false },
} as const;
const RING_SCALE = [2.1, 2.3, 2.5] as const;
const RING_PHASE = [0, 1.1 / 3.1, 2.3 / 3.6] as const;
const RING_STILL = {
  calm: [
    [1.2, 0.3],
    [1.5, 0.2],
    [1.8, 0.1],
  ],
  speaking: [
    [1.35, 0.5],
    [1.7, 0.34],
    [2.05, 0.18],
  ],
} as const;

function pulse({ size, hues, scheme, state, m, still: frozen, id }: Look): React.ReactNode {
  const { from, to } = hues;
  const light = scheme === 'light';
  const glowGain = state === 'connecting' ? 0.6 : state === 'disabled' ? 0.4 : 1;
  const core = state === 'connecting' ? { from: grey(from, 0.25), to: grey(to, 0.25) } : { from, to };
  const rings = state === 'idle' || state === 'listening' || state === 'speaking' ? RINGS[state] : null;
  const ringColors = [mix(from, to, 0.28), mix(from, to, 0.6), mix(from, to, 0.88)];
  const ringSide = size * 0.42;
  const arcSide = size * 0.54;
  const arcOpacity = state === 'thinking' ? 1 : state === 'connecting' ? 0.75 : 0;
  const arcPx = 100 / arcSide;

  return (
    <>
      <Animated.View key="glow" style={[layer(size, 0), { opacity: m.level(0.5 * glowGain, 0.5 * glowGain), transform: [{ scale: m.level(0.95, 0.22) }] }]}>
        {svg(
          size,
          <>
            <Defs>
              {soft(`${id}g1`, { c: from, a: light ? 0.9 : 0.7 })}
              {soft(`${id}g2`, { c: to, a: light ? 0.84 : 0.64 })}
            </Defs>
            <Circle cx={42} cy={40} r={36} fill={`url(#${id}g1)`} />
            <Circle cx={58} cy={60} r={37} fill={`url(#${id}g2)`} />
          </>,
        )}
      </Animated.View>
      {rings !== null
        ? ringColors.map((color, i) => {
            const cycles = rings.cycles[i] ?? 1;
            const grow = (RING_SCALE[i] ?? 2) - 1;
            const still = (state === 'speaking' ? RING_STILL.speaking : RING_STILL.calm)[i] ?? [1, 0];
            const dir = (u: number) => (rings.reverse ? 1 - u : u);
            const emit = (u: number) => (u < 0.14 ? easeOut(u / 0.14) : 1 - easeOut((u - 0.14) / 0.86));
            return (
              <Animated.View key={`ring${i}`} style={[layer(size, 0.29), { opacity: frozen ? rings.set : m.level(0.4 * rings.set, 0.5 * rings.set) }]}>
                <Animated.View
                  style={{
                    width: ringSide,
                    height: ringSide,
                    borderRadius: ringSide / 2,
                    borderWidth: 1.5,
                    borderColor: color,
                    opacity: m.cycle(cycles, (u) => emit(dir(u)), still[1], RING_PHASE[i] ?? 0, 6),
                    transform: [{ scale: m.cycle(cycles, (u) => 1 + grow * easeOut(dir(u)), still[0], RING_PHASE[i] ?? 0, 6) }],
                  }}
                />
              </Animated.View>
            );
          })
        : null}
      {arcOpacity > 0 ? (
        <Animated.View key="arc" style={[layer(size, 0.23), { opacity: arcOpacity, transform: [{ rotate: m.spin(15) }] }]}>
          <Animated.View style={{ width: arcSide, height: arcSide, transform: [{ rotate: state === 'thinking' ? m.spin(8) : '0deg' }] }}>
            {svg(
              arcSide,
              <>
                <Defs>{soft(`${id}h`, { c: to, a: 0.75 })}</Defs>
                {conicRing(
                  [
                    { at: 55, ink: { c: from, a: 0 } },
                    { at: 140, ink: { c: from, a: 0.22 } },
                    { at: 250, ink: { c: mix(from, to, 0.55), a: 1 } },
                    { at: 354, ink: { c: to, a: 1 } },
                  ],
                  0,
                  46.4,
                  Math.max(3.75, 2.5 * arcPx),
                  6,
                )}
                <Circle cx={50} cy={2.75} r={6} fill={`url(#${id}h)`} />
                <Circle cx={50} cy={2.75} r={3.25} fill={to} />
              </>,
            )}
          </Animated.View>
        </Animated.View>
      ) : null}
      <Animated.View
        key="core"
        style={[layer(size, 0.29), { transform: [{ scale: state === 'thinking' ? m.cycle(12, (u) => 1 + 0.05 * wave(u), 1) : 1 }] }]}
      >
        <Animated.View
          style={{
            width: ringSide,
            height: ringSide,
            opacity: state === 'error' ? m.cycle(20, blink, 1, 0, 26) : 1,
            transform: [{ scale: m.level(1, 0.14) }, { scale: state === 'idle' ? m.cycle(9, (u) => 1 + 0.05 * wave(u), 1) : 1 }],
          }}
        >
          {svg(
            ringSide,
            <>
              <Defs>
                <RadialGradient id={`${id}o`} cx="32" cy="28" r="120" fx="32" fy="28" gradientUnits="userSpaceOnUse">
                  {stops([
                    [0, { c: mix(core.from, '#ffffff', 0.6), a: 1 }],
                    [0.3, { c: core.from, a: 1 }],
                    [0.78, { c: core.to, a: 1 }],
                    [1, { c: mix(core.to, '#000000', 0.35), a: 1 }],
                  ])}
                </RadialGradient>
                <RadialGradient id={`${id}n`} cx="38%" cy="32%" r="62%">
                  {stops([
                    [0.7, { c: mix(core.to, '#000000', 0.6), a: 0 }],
                    [1, { c: mix(core.to, '#000000', 0.6), a: 0.55 }],
                  ])}
                </RadialGradient>
                <RadialGradient id={`${id}w`} cx="58%" cy="62%" r="58%">
                  {stops([
                    [0.8, { c: '#ffffff', a: 0 }],
                    [1, { c: '#ffffff', a: 0.4 }],
                  ])}
                </RadialGradient>
                <RadialGradient id={`${id}x`} cx="50%" cy="50%" r="50%">
                  {stops([
                    [0, { c: '#ffffff', a: 0.9 }],
                    [1, { c: '#ffffff', a: 0 }],
                  ])}
                </RadialGradient>
              </Defs>
              <Circle cx={50} cy={50} r={50} fill={`url(#${id}o)`} />
              <Circle cx={50} cy={50} r={50} fill={`url(#${id}n)`} />
              <Circle cx={50} cy={50} r={50} fill={`url(#${id}w)`} />
              <G transform="rotate(-20 36 23)">
                <Ellipse cx={36} cy={23} rx={20} ry={13} fill={`url(#${id}x)`} />
              </G>
            </>,
          )}
        </Animated.View>
      </Animated.View>
    </>
  );
}

/** The error blink: two dips in the first quarter of each cycle. */
function blink(u: number): number {
  const keys: ReadonlyArray<readonly [number, number]> = [
    [0, 1],
    [0.07, 0.35],
    [0.13, 0.9],
    [0.2, 0.35],
    [0.26, 1],
    [1, 1],
  ];
  for (let i = 1; i < keys.length; i += 1) {
    const lo = keys[i - 1];
    const hi = keys[i];
    if (lo !== undefined && hi !== undefined && u <= hi[0]) return lo[1] + ((hi[1] - lo[1]) * (u - lo[0])) / (hi[0] - lo[0]);
  }
  return 1;
}

export default function Orb({
  variant = 'glass',
  size = 160,
  from = 'primary',
  to = 'tertiary',
  state = 'idle',
  level = -1,
  speed = 1,
  paused = false,
  accessibilityLabel,
  style,
}: OrbProps) {
  const palette = usePalette();
  const scheme = useScheme();
  const reduced = useReducedMotion();
  const still = paused || reduced;
  const procedural = !(level >= 0);
  const given = procedural ? REST_LEVEL[state] : clampOrbLevel(level);
  const period = PERIOD / Math.min(4, Math.max(0.25, Number.isFinite(speed) ? speed : 1));
  const clock = useRef(new Animated.Value(0)).current;
  const smooth = useRef(new Animated.Value(given)).current;
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (still) return undefined;
    clock.setValue(0);
    const loop = Animated.loop(Animated.timing(clock, { toValue: 1, duration: period, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [still, period, clock]);

  useEffect(() => {
    if (still || procedural) return undefined;
    // A voice level arrives at up to 30 Hz: a stiff, unbouncy spring rounds the steps off.
    const spring = Animated.spring(smooth, { toValue: given, speed: 24, bounciness: 0, useNativeDriver: true });
    spring.start();
    return () => spring.stop();
  }, [still, procedural, given, smooth]);

  useEffect(() => {
    if (still || state !== 'error') return undefined;
    const step = (toValue: number) => Animated.timing(shake, { toValue, duration: 64, easing: Easing.inOut(Easing.quad), useNativeDriver: true });
    const shakeOnce = Animated.sequence([step(-2), step(4), step(-3), step(1.5), step(0)]);
    shakeOnce.start();
    return () => shakeOnce.stop();
  }, [still, state, shake]);

  const hues = huesOf(palette, from, to, state);
  const look: Look = {
    size,
    hues,
    scheme,
    state,
    m: motionOf(still, clock, smooth, procedural ? proceduralTrack(state) : null, given),
    still,
    id: idOf(`${variant}${scheme}${state}${hues.from}${hues.to}`),
  };

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? LABELS[state]}
      style={[{ width: size, height: size }, style]}
    >
      <Animated.View
        style={{ width: size, height: size, opacity: state === 'disabled' ? 0.5 : 1, transform: [{ translateX: still ? 0 : shake }] }}
      >
        {variant === 'pulse' ? pulse(look) : glass(look)}
      </Animated.View>
    </View>
  );
}
