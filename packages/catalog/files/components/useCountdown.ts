// Time left until a moment (a sale's end, a booking hold): the total in
// ms, its days / hours / minutes / seconds, two-digit strings for a
// "02 : 15 : 09" display, and `done`. Ticks every second while there is
// time left, from the device clock. `countdownParts(ms)` is the pure
// breakdown, for tests and for a value that comes from elsewhere.

import { useEffect, useState } from 'react';

export interface Countdown {
  /** Ms left, never below 0. */
  total: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Zero-padded to two digits (days may be longer). */
  dd: string;
  hh: string;
  mm: string;
  ss: string;
  done: boolean;
}

export interface CountdownOptions {
  /** Ms between ticks. Default 1000. */
  interval?: number;
  /** false freezes the countdown at its current value. Default true. */
  enabled?: boolean;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const pad = (n: number) => String(n).padStart(2, '0');

export function countdownParts(remainingMs: number): Countdown {
  const total = Math.max(0, Math.floor(remainingMs));
  const days = Math.floor(total / DAY);
  const hours = Math.floor((total % DAY) / HOUR);
  const minutes = Math.floor((total % HOUR) / MINUTE);
  const seconds = Math.floor((total % MINUTE) / SECOND);
  return { total, days, hours, minutes, seconds, dd: pad(days), hh: pad(hours), mm: pad(minutes), ss: pad(seconds), done: total === 0 };
}

function timeOf(target: number | string | Date): number {
  const ms = target instanceof Date ? target.getTime() : typeof target === 'number' ? target : Date.parse(target);
  return Number.isFinite(ms) ? ms : 0;
}

export default function useCountdown(target: number | string | Date, { interval = 1000, enabled = true }: CountdownOptions = {}): Countdown {
  const end = timeOf(target);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled || end <= Date.now()) return;
    setNow(Date.now());
    const timer = setInterval(() => {
      const at = Date.now();
      setNow(at);
      if (at >= end) clearInterval(timer);
    }, interval);
    return () => clearInterval(timer);
  }, [end, interval, enabled]);

  return countdownParts(end - now);
}
