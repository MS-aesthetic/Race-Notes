export interface RgbColor { r: number; g: number; b: number; }

const FALLBACK_ACCENT = '#8a2027';
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export function parseHexColor(value: string): RgbColor | null {
  const match = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(value);
  if (!match) return null;
  const raw = match[1].length === 3 ? match[1].split('').map(char => `${char}${char}`).join('') : match[1];
  return { r: Number.parseInt(raw.slice(0, 2), 16), g: Number.parseInt(raw.slice(2, 4), 16), b: Number.parseInt(raw.slice(4, 6), 16) };
}

export function rgbToHex({ r, g, b }: RgbColor): string {
  return `#${[r, g, b].map(value => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0')).join('')}`;
}

function linearChannel(channel: number) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color: RgbColor): number {
  return 0.2126 * linearChannel(color.r) + 0.7152 * linearChannel(color.g) + 0.0722 * linearChannel(color.b);
}

export function contrastRatio(first: string, second: string): number {
  const a = parseHexColor(first);
  const b = parseHexColor(second);
  if (!a || !b) return 1;
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

interface HslColor { h: number; s: number; l: number; }

function rgbToHsl({ r, g, b }: RgbColor): HslColor {
  const [red, green, blue] = [r / 255, g / 255, b / 255];
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const delta = max - min;
  const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  const h = ((max === red ? (green - blue) / delta + (green < blue ? 6 : 0) : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4) / 6);
  return { h, s, l };
}

function hslToRgb({ h, s, l }: HslColor): RgbColor {
  if (s === 0) return { r: l * 255, g: l * 255, b: l * 255 };
  const hue = (p: number, q: number, t: number) => {
    const value = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (value < 1 / 6) return p + (q - p) * 6 * value;
    if (value < 1 / 2) return q;
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return { r: 255 * hue(p, q, h + 1 / 3), g: 255 * hue(p, q, h), b: 255 * hue(p, q, h - 1 / 3) };
}

/** Presentation-only light-theme accent. Input is never normalized or persisted. */
export function deriveReadableLightAccent(storedAccent: string, surface = '#e1dedc', minimumRatio = 4.5): string {
  const source = parseHexColor(storedAccent) ?? parseHexColor(FALLBACK_ACCENT)!;
  const safeSurface = parseHexColor(surface) ? surface : '#e1dedc';
  const sourceHex = rgbToHex(source);
  if (contrastRatio(sourceHex, safeSurface) >= minimumRatio) return sourceHex;
  const sourceHsl = rgbToHsl(source);
  // This helper serves light-mode surfaces. Very light user accents must darken
  // even when they are technically lighter than the background.
  const surfaceIsLighter = relativeLuminance(parseHexColor(safeSurface)!) > 0.5;
  let low = surfaceIsLighter ? 0 : sourceHsl.l;
  let high = surfaceIsLighter ? sourceHsl.l : 1;
  let best = surfaceIsLighter ? 0 : 1;
  for (let iteration = 0; iteration < 24; iteration += 1) {
    const lightness = (low + high) / 2;
    const candidate = rgbToHex(hslToRgb({ ...sourceHsl, l: lightness }));
    if (contrastRatio(candidate, safeSurface) >= minimumRatio) {
      best = lightness;
      if (surfaceIsLighter) low = lightness; else high = lightness;
    } else if (surfaceIsLighter) high = lightness; else low = lightness;
  }
  return rgbToHex(hslToRgb({ ...sourceHsl, l: best }));
}

export function readableOnColor(background: string): string {
  return contrastRatio('#ffffff', background) >= contrastRatio('#1c1b1b', background) ? '#ffffff' : '#1c1b1b';
}
