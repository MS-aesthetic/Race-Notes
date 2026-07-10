/*
 * Vendored HERE Flexible Polyline decoder.
 * Ported to TypeScript from HERE's MIT-licensed reference implementation:
 *   https://github.com/heremaps/flexible-polyline  (javascript/index.js)
 *
 * Copyright (C) 2019 HERE Europe B.V.
 * Licensed under MIT. See the upstream repository for the full license text.
 *
 * Only `decode` (2D) is needed by CREW CHIEF. The header's third-dimension
 * values are consumed correctly (so 3D polylines still decode) but dropped.
 * Arithmetic uses multiply/divide (not bit-shift) to stay 53-bit safe for
 * high-precision inputs.
 */

// charCode(char) - 45  ->  5-bit value (or -1 for invalid)
const DECODING_TABLE = [
  62, -1, -1, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, -1, -1, -1,
  -1, -1, -1, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
  12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, -1, -1,
  -1, -1, 63, -1, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37,
  38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51,
];

function decodeChar(char: string): number {
  const value = DECODING_TABLE[char.charCodeAt(0) - 45];
  if (value === undefined || value < 0) {
    throw new Error(`flexpolyline: invalid encoding character "${char}"`);
  }
  return value;
}

/** Split the encoded string into the sequence of unsigned integers. */
function decodeUnsignedValues(encoded: string): number[] {
  let result = 0;
  let shiftFactor = 1; // 2 ** shift, accumulated multiplicatively
  const out: number[] = [];
  for (const char of encoded) {
    const value = decodeChar(char);
    result += (value & 0x1f) * shiftFactor;
    if ((value & 0x20) === 0) {
      out.push(result);
      result = 0;
      shiftFactor = 1;
    } else {
      shiftFactor *= 32;
    }
  }
  return out;
}

/** Zig-zag decode: LSB is the sign bit. */
function toSigned(value: number): number {
  const negative = value % 2 === 1;
  const magnitude = Math.floor(value / 2);
  return negative ? -(magnitude + 1) : magnitude;
}

interface FlexHeader {
  precision: number;
  thirdDim: number;
  thirdDimPrecision: number;
}

function decodeHeader(version: number, encodedHeader: number): FlexHeader {
  if (version !== 1) {
    throw new Error(`flexpolyline: unsupported version ${version}`);
  }
  const precision = encodedHeader & 15;
  const thirdDim = (Math.floor(encodedHeader / 16)) & 7;
  const thirdDimPrecision = (Math.floor(encodedHeader / 128)) & 15;
  return { precision, thirdDim, thirdDimPrecision };
}

/**
 * Decode a HERE flexible polyline string into `[lat, lng]` pairs.
 * Third-dimension (elevation, etc.) values are consumed but not returned.
 */
export function decode(encoded: string): [number, number][] {
  if (!encoded) return [];
  const values = decodeUnsignedValues(encoded);
  const header = decodeHeader(values[0], values[1]);
  const factorDegree = 10 ** header.precision;
  const hasThirdDim = header.thirdDim > 0;

  let lastLat = 0;
  let lastLng = 0;
  const result: [number, number][] = [];

  const step = hasThirdDim ? 3 : 2;
  for (let i = 2; i + 1 < values.length; i += step) {
    lastLat += toSigned(values[i]) / factorDegree;
    lastLng += toSigned(values[i + 1]) / factorDegree;
    // third-dimension value at values[i + 2] is intentionally skipped
    result.push([
      Number(lastLat.toFixed(header.precision)),
      Number(lastLng.toFixed(header.precision)),
    ]);
  }
  return result;
}
