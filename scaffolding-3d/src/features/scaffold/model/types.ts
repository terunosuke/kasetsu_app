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

/** 標準の1段（1層）の高さ */
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
  isStair?: boolean; // 階段スパン（1スパン = 階段1セット）
  /** 開口部（梁枠）の高さ（層数1〜3）。未設定 = 開口ではない */
  openingLevels?: number;
  /**
   * このベイの直前で列が直角に曲がる場合のコーナーの勝ち負け。
   * 'prev' = 手前（先に描いた）軸が勝ち（デフォルト）／ 'next' = このベイの軸が勝ち。
   * 勝ち軸のアンチをコーナー端まで通し、負け軸は勝ち軸の面まで寄せる。
   */
  cornerWin?: 'prev' | 'next';
  /**
   * 建物側の面を反転するか（辺＝区間ごと）。
   * XYの向きが変わるコーナーを境界に、同じ向きの連続スパン（1辺）で共通の値を持つ。
   * false（既定）: 内面（-perp側）＝建物側に壁つなぎ・層間ネット、外面にメッシュシート。
   * true: 建物側と外周側を入れ替える。
   */
  flipSides?: boolean;
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

/**
 * 側面（長手方向の面）の構成。
 *   braceAndRail: 外面に先行手摺（×型ブレス）＋内面に二段手摺（H450+H900）
 *   bothRail:     両面とも二段手摺
 *   bothBrace:    両面とも先行手摺（×型ブレス）
 */
export type SideMode = 'braceAndRail' | 'bothRail' | 'bothBrace';

/** 壁つなぎの種別（サイズレンジ） */
export type WallTieKind =
  | 'none'
  | 'KTS16'
  | 'KTS20'
  | 'KTS30'
  | 'KTS45'
  | 'KTS60'
  | 'KTS80'
  | 'KTS100';

/** 支柱の手動構成（長さ→1建地あたりの本数） */
export type PillarSelection = Record<number, number>;

/** 全体設定（変更すると配置済みの足場すべてに即時反映される） */
export interface GlobalSettings {
  // --- 基本 ---
  levels: number; // 段数
  topLevelIs900: boolean; // 最上段を900mmにする
  width: WidthMM; // 新しく描く列の枠幅
  sideMode: SideMode; // 側面の構成（先行手摺/二段手摺）
  tsumaCount: 0 | 1 | 2; // 妻側（手すり・巾木）を付ける面数（列ごとの端部数）

  // --- 支柱・ジャッキ ---
  pillarOverride: PillarSelection | null; // null = 高さから自動解決
  jackBaseMode: 'none' | 'jackOnly' | 'jackWithTaiko';
  jackBaseOption: 'allSB20' | 'allSB40' | 'custom';
  sb20Count: number; // custom 時の総数
  sb40Count: number;
  taiko40: number; // タイコ（総数）
  taiko80: number;
  negarami: boolean; // 根がらみ支柱
  basePlate: boolean; // 敷板

  // --- アンチ・巾木 ---
  antiMode: 'all' | 'notBottom' | 'custom';
  antiLevels: string; // custom 時 "1,3,5"
  toeboardFaces: 'both' | 'single' | 'none';
  toeboardMode: 'all' | 'sameAsAnti' | 'custom';
  toeboardLevels: string;

  // --- 階段（スパンの階段化は3D側で指定） ---
  stairMode: 'notTop' | 'custom'; // 階段の設置段
  stairLevels: string;
  stairWidening: boolean; // 拡幅（枠幅914 → 1219差替＋短手布材305等）

  /** 開口部（梁わく）の方杖サイズ。SPL54・72 使用時に 4本/開口を計上 */
  spsSize: 18 | 15 | 12 | 9;

  // --- 壁つなぎ ---
  wallTieMode: WallTieKind;
  wallTieLevelMode: 'all' | 'alternate' | 'custom';
  wallTieLevelCount: number;
  wallTieSpanMode: 'all' | 'alternate' | 'custom';
  wallTieSpanCount: number;

  // --- 層間養生ネット ---
  layerNet: boolean;
  layerNetLevelMode: 'all' | 'alternate' | 'custom';
  layerNetLevelCount: number;

  // --- 外周メッシュシート ---
  sheet: boolean;
  sheetLevelMode: 'all' | 'custom';
  sheetLevelCount: number;
  tsumaSheetCount: 0 | 1 | 2;

  // --- その他 ---
  memo: string;
}

export const DEFAULT_SETTINGS: GlobalSettings = {
  levels: 3,
  topLevelIs900: false,
  width: 914,
  sideMode: 'braceAndRail',
  tsumaCount: 2,

  pillarOverride: null,
  jackBaseMode: 'jackOnly',
  jackBaseOption: 'allSB20',
  sb20Count: 0,
  sb40Count: 0,
  taiko40: 0,
  taiko80: 0,
  negarami: true,
  basePlate: true,

  antiMode: 'all',
  antiLevels: '',
  toeboardFaces: 'both',
  toeboardMode: 'sameAsAnti',
  toeboardLevels: '',

  stairMode: 'notTop',
  stairLevels: '',
  stairWidening: false,
  spsSize: 18,

  wallTieMode: 'none',
  wallTieLevelMode: 'all',
  wallTieLevelCount: 1,
  wallTieSpanMode: 'all',
  wallTieSpanCount: 1,

  layerNet: false,
  layerNetLevelMode: 'all',
  layerNetLevelCount: 1,

  sheet: false,
  sheetLevelMode: 'all',
  sheetLevelCount: 1,
  tsumaSheetCount: 0,

  memo: '',
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

/** 各段の高さ（mm）の配列。最上段900オプションを反映 */
export function liftHeights(s: Pick<GlobalSettings, 'levels' | 'topLevelIs900'>): number[] {
  const heights = Array.from({ length: s.levels }, () => LIFT_MM);
  if (s.topLevelIs900 && heights.length > 0) heights[heights.length - 1] = 900;
  return heights;
}

/** 足場の総高さ（mm） */
export function totalHeightMm(s: Pick<GlobalSettings, 'levels' | 'topLevelIs900'>): number {
  return liftHeights(s).reduce((a, b) => a + b, 0);
}

/** 各段の下端高さ（mm・ベースからの累積）。cum[0]=0, cum[levels]=総高さ */
export function cumulativeHeights(s: Pick<GlobalSettings, 'levels' | 'topLevelIs900'>): number[] {
  const cum = [0];
  let acc = 0;
  for (const h of liftHeights(s)) {
    acc += h;
    cum.push(acc);
  }
  return cum;
}

/**
 * ベースオフセット（地面から1段目下端までの高さ・mm）。
 * ジャッキベース SB20=200 / SB40=400、根がらみ支柱があればさらに+225。
 */
export function baseOffsetMm(
  s: Pick<GlobalSettings, 'jackBaseMode' | 'jackBaseOption' | 'negarami'>,
): number {
  if (s.jackBaseMode === 'none') return 0;
  const jack = s.jackBaseOption === 'allSB40' ? 400 : 200;
  return jack + (s.negarami ? 225 : 0);
}

/** "1,3,5" 形式の段指定をパースする */
export function parseLevels(str: string): number[] {
  if (!str) return [];
  return str
    .split(/[,、\s]+/)
    .map((x) => parseInt(x.trim(), 10))
    .filter((x) => !isNaN(x) && x >= 1);
}

/** アンチの設置段を解決する */
export function resolveAntiLevels(s: GlobalSettings): number[] {
  if (s.antiMode === 'all') return Array.from({ length: s.levels }, (_, i) => i + 1);
  if (s.antiMode === 'notBottom')
    return Array.from({ length: Math.max(0, s.levels - 1) }, (_, i) => i + 2);
  return parseLevels(s.antiLevels).filter((l) => l <= s.levels);
}

/** 巾木の設置段を解決する */
export function resolveToeboardLevels(s: GlobalSettings): number[] {
  if (s.toeboardFaces === 'none') return [];
  if (s.toeboardMode === 'all') return Array.from({ length: s.levels }, (_, i) => i + 1);
  if (s.toeboardMode === 'sameAsAnti') return resolveAntiLevels(s);
  return parseLevels(s.toeboardLevels).filter((l) => l <= s.levels);
}

/** 階段の設置段を解決する */
export function resolveStairLevels(s: GlobalSettings): number[] {
  if (s.stairMode === 'notTop')
    return Array.from({ length: Math.max(0, s.levels - 1) }, (_, i) => i + 1);
  return parseLevels(s.stairLevels).filter((l) => l <= s.levels);
}

/**
 * 連続する階段スパンを「セット」にまとめる（1セット = 最大2スパン）。
 * 2スパン連続 → 斜め型階段（2段を一気に登る）、単独1スパン → 垂直型階段。
 * 3スパン以上連続した場合は 2+1 のように分割する。
 * 戻り値は各セットに属するベイ index の配列。
 */
export function stairGroups(bays: Bay[]): number[][] {
  const groups: number[][] = [];
  let current: number[] = [];
  const flush = () => {
    if (current.length > 0) groups.push(current);
    current = [];
  };
  bays.forEach((bay, i) => {
    if (bay.isStair) {
      current.push(i);
      if (current.length === 2) flush();
    } else {
      flush();
    }
  });
  flush();
  return groups;
}

/**
 * 拡幅の対象スパン（階段セット＋両隣）を返す（sub-alba 準拠）。
 * 拡幅は枠幅914の列でのみ 3D 形状に反映される。
 */
export function widenedBaySet(bays: Bay[]): Set<number> {
  const widened = new Set<number>();
  for (const group of stairGroups(bays)) {
    const lo = Math.max(0, group[0] - 1);
    const hi = Math.min(bays.length - 1, group[group.length - 1] + 1);
    for (let i = lo; i <= hi; i++) widened.add(i);
  }
  return widened;
}

/** 開口部（梁枠）のグループ。連続する開口スパンを1開口とする */
export interface OpeningGroup {
  bayIndices: number[];
  levels: number; // 開口の高さ（層数）
  lengthMm: number; // 開口幅の合計
}

/** 連続する開口スパンをグループ化する（高さはグループ先頭の値に統一して扱う） */
export function openingGroups(bays: Bay[]): OpeningGroup[] {
  const groups: OpeningGroup[] = [];
  let current: number[] = [];
  const flush = () => {
    if (current.length > 0) {
      groups.push({
        bayIndices: current,
        levels: bays[current[0]].openingLevels ?? 1,
        lengthMm: current.reduce((sum, i) => sum + bays[i].span, 0),
      });
    }
    current = [];
  };
  bays.forEach((bay, i) => {
    if (bay.openingLevels && !bay.isStair) current.push(i);
    else flush();
  });
  flush();
  return groups;
}

/** 開口グループの内部節点（両端を除く、梁枠上に立つ支柱位置）の index 一覧 */
export function openingInteriorNodes(group: OpeningGroup): number[] {
  const first = group.bayIndices[0];
  const last = group.bayIndices[group.bayIndices.length - 1];
  const nodes: number[] = [];
  for (let n = first + 1; n <= last; n++) nodes.push(n);
  return nodes;
}

// ============ コーナー（L字直角）処理 ============
//
// 列の途中で向きが変わる位置をコーナーとし、直線区間（セグメント）に分割する。
// 直角コーナーの納まり（突き付け＋角スパン）:
//   ・手前区間（負け側でも位置は変えない）はコーナー節点で終わる
//   ・後区間は「前方(dirPrev)+進行方向(dirNext) に W/2 ずつ」シフトし、
//     手前区間の端部の先に横付けする
//   ・その間にできる W×W の角ブロックを「角スパン（長さ=枠幅）」として勝ち軸が持つ
//     （角スパンのアンチ・外面ブレス/手すり・端部手すり・外側の建地を描画/計上）
//   ・角ブロックの支柱は手前区間の端部支柱・後区間の始端支柱と共有（アルバは兼用）
//
// cornerWin はどちらの軸が角スパンを持つか（デフォルト 'prev' = 先に描いた軸）。

/** 直角コーナーの情報 */
export interface CornerInfo {
  /** 向きが変わった直後のベイ index（cornerWin を保持するベイ） */
  bayIndex: number;
  winner: 'prev' | 'next';
  dirPrev: Vec2;
  dirNext: Vec2;
  /** 手前区間の終端節点（シフト適用後、mm）。角ブロックはここから dirPrev 方向に W 進み、dirNext 直交に ±W/2 */
  base: Vec2;
  /** 直交コーナーか（折返し等 false のときは位置調整なし） */
  perpendicular: boolean;
}

/** 直線区間。origin はコーナーシフト適用後の始点（mm） */
export interface RunSegment {
  origin: Vec2;
  bays: Bay[];
  startBayIndex: number;
  cornerAtStart: CornerInfo | null;
  cornerAtEnd: CornerInfo | null;
}

/** 列を直線区間に分割し、コーナーの勝ち負けに応じたシフトを適用する */
export function runSegments(run: Pick<Run, 'origin' | 'bays' | 'width'>): {
  segments: RunSegment[];
  corners: CornerInfo[];
} {
  const { bays } = run;
  const segments: RunSegment[] = [];
  const corners: CornerInfo[] = [];
  if (bays.length === 0) return { segments, corners };

  const halfW = run.width / 2;
  const raw = nodePoints(run);

  // 区間境界（向きが変わるベイ index）
  const bounds = [0];
  for (let i = 1; i < bays.length; i++) {
    if (bays[i].dir.x !== bays[i - 1].dir.x || bays[i].dir.z !== bays[i - 1].dir.z) bounds.push(i);
  }
  bounds.push(bays.length);

  const offset: Vec2 = { x: 0, z: 0 };
  for (let s = 0; s < bounds.length - 1; s++) {
    const from = bounds[s];
    let cornerAtStart: CornerInfo | null = null;

    if (from > 0) {
      const dirPrev = bays[from - 1].dir;
      const dirNext = bays[from].dir;
      const perpendicular =
        Math.abs(dirPrev.x * dirNext.x + dirPrev.z * dirNext.z) < 0.5;
      const winner = bays[from].cornerWin ?? 'prev';
      // 角ブロックの基準 = 手前区間の終端節点（シフト適用前のオフセットで確定）
      const base: Vec2 = { x: raw[from].x + offset.x, z: raw[from].z + offset.z };
      // 後区間は「前方 W/2 + 進行方向 W/2」シフト → 手前区間の端の先に横付けし、
      // 間の W×W ブロックを角スパンが埋める
      if (perpendicular) {
        offset.x += (dirPrev.x + dirNext.x) * halfW;
        offset.z += (dirPrev.z + dirNext.z) * halfW;
      }
      cornerAtStart = { bayIndex: from, winner, dirPrev, dirNext, base, perpendicular };
      corners.push(cornerAtStart);
    }

    segments.push({
      origin: { x: raw[from].x + offset.x, z: raw[from].z + offset.z },
      bays: bays.slice(from, bounds[s + 1]),
      startBayIndex: from,
      cornerAtStart,
      cornerAtEnd: null,
    });
  }
  for (let s = 0; s < segments.length - 1; s++) {
    segments[s].cornerAtEnd = segments[s + 1].cornerAtStart;
  }
  return { segments, corners };
}
