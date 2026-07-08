/**
 * 寸法適合の純関数群。React にも Three.js にも依存しない。
 */
import { PILLAR_LENGTHS } from '../catalog/albatross';
import { SPANS, type SpanMM, type Vec2 } from './types';

/** ポインタ座標のスナップ（100mm 単位） */
export function snapMM(v: number): number {
  return Math.round(v / 100) * 100;
}

export function snapPoint(p: Vec2): Vec2 {
  return { x: snapMM(p.x), z: snapMM(p.z) };
}

/**
 * 始点→カーソルのベクトルを軸平行に丸め、進行方向と有効長さを返す。
 * 感覚的な操作のため XZ の大きい方の軸に自動スナップする。
 */
export function segmentFrom(from: Vec2, to: Vec2): { dir: Vec2; length: number } {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  if (Math.abs(dx) >= Math.abs(dz)) {
    return { dir: { x: dx >= 0 ? 1 : -1, z: 0 }, length: Math.abs(dx) };
  }
  return { dir: { x: 0, z: dz >= 0 ? 1 : -1 }, length: Math.abs(dz) };
}

/**
 * 長さ（mm）をスパン規格の並びに自動分割する。
 * 1829 を優先で詰め、端数は最も近い規格に丸める（305mm 未満の端数は無視）。
 */
export function fitSpans(lengthMm: number): SpanMM[] {
  const result: SpanMM[] = [];
  let rest = lengthMm;
  while (rest >= 1829) {
    result.push(1829);
    rest -= 1829;
  }
  if (rest >= 305) {
    let best: SpanMM = SPANS[0];
    for (const s of SPANS) {
      if (Math.abs(s - rest) < Math.abs(best - rest)) best = s;
    }
    result.push(best);
  }
  return result;
}

/**
 * 目標高さ（mm）を支柱規格の組合せに解決する（長い順の貪欲法）。
 * 段高 1800 の倍数は常に端数なしで解決できる。
 */
export function pillarComboFor(heightMm: number): Record<number, number> {
  const combo: Record<number, number> = {};
  let rest = heightMm;
  for (const len of PILLAR_LENGTHS) {
    const n = Math.floor(rest / len);
    if (n > 0) {
      combo[len] = n;
      rest -= n * len;
    }
  }
  return combo;
}

/**
 * 支柱のジョイント高さ（mm・ベースからの累積）を計算する。
 * 長い支柱から順に積み上げ、総高さ未満の継ぎ目位置を返す（sub-alba 準拠）。
 */
export function pillarJointHeights(
  combo: Record<number, number>,
  totalMm: number,
): number[] {
  const lengths: number[] = [];
  for (const [len, count] of Object.entries(combo)) {
    for (let i = 0; i < count; i++) lengths.push(Number(len));
  }
  lengths.sort((a, b) => b - a);
  const joints: number[] = [];
  let acc = 0;
  for (const len of lengths) {
    acc += len;
    if (acc < totalMm) joints.push(acc);
    else break;
  }
  return joints;
}

/** スパン構成の表示用テキスト（例: "1829×3 + 914×1"） */
export function spanBreakdownText(spans: SpanMM[]): string {
  const counts = new Map<SpanMM, number>();
  for (const s of spans) counts.set(s, (counts.get(s) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([span, n]) => `${span}×${n}`)
    .join(' + ');
}
