/**
 * 配置モデルの型定義。
 * ストアに保存するのはここにあるパラメータのみ。
 * 部材リスト・3Dジオメトリは常にここから導出する（logic/ 参照）。
 */

/** スパン規格（アルバトロス・インチ系） */
export type SpanMM = 610 | 914 | 1219 | 1524 | 1829;

/** 枠幅（短手方向）規格 */
export type WidthMM = 450 | 610 | 914 | 1219;

export const SPANS: SpanMM[] = [610, 914, 1219, 1524, 1829];
export const WIDTHS: WidthMM[] = [450, 610, 914, 1219];

/** 1段（1層）の高さ */
export const LIFT_MM = 1800;

/** 平面座標（mm）。3D空間では x→X軸, z→Z軸, 高さはY軸 */
export interface Vec2 {
  x: number;
  z: number;
}

/** 1スパン分の枠。方向は軸平行の単位ベクトル */
export interface Bay {
  id: string;
  span: SpanMM;
  dir: Vec2; // {x:±1,z:0} または {x:0,z:±1}
}

/**
 * ひと続きの足場の列。描画した線が1つの Run になる。
 * 節点座標は origin + bays の累積で常に導出する（スパン変更に自動追従）。
 */
export interface Run {
  id: string;
  origin: Vec2;
  width: WidthMM;
  bays: Bay[];
}

/** 全体設定（変更すると配置済みの足場すべてに即時反映される） */
export interface GlobalSettings {
  levels: number; // 段数（1段 = 1800mm）
  width: WidthMM; // 新しく描く列の枠幅
  jackBase: 'SB20' | 'SB40';
  negarami: boolean; // 根がらみ支柱
  toeboard: boolean; // 巾木（両面）
  tsuma: boolean; // 妻側手すり・妻側巾木（列の両端）
  basePlate: boolean; // 敷板
}

export const DEFAULT_SETTINGS: GlobalSettings = {
  levels: 3,
  width: 914,
  jackBase: 'SB20',
  negarami: true,
  toeboard: true,
  tsuma: true,
  basePlate: true,
};

/** Run の節点（支柱建て位置＝中心線上）を導出する */
export function nodePoints(run: Pick<Run, 'origin' | 'bays'>): Vec2[] {
  const pts: Vec2[] = [{ ...run.origin }];
  let cur = { ...run.origin };
  for (const bay of run.bays) {
    cur = { x: cur.x + bay.dir.x * bay.span, z: cur.z + bay.dir.z * bay.span };
    pts.push({ ...cur });
  }
  return pts;
}

/** Run の全長（mm） */
export function runLength(run: Pick<Run, 'bays'>): number {
  return run.bays.reduce((sum, b) => sum + b.span, 0);
}
