/**
 * 次世代足場 3Dシミュレーション＆数量拾いアプリ — データモデル定義（ドラフト）
 *
 * 設計書: docs/3d-app-design.md
 * 3層構造:
 *   ① 規格マスタ層 … 部材カタログ・寸法適合ルール（不変）
 *   ② 配置層       … ユーザー操作対象のパラメータのみ（Zustand に保存）
 *   ③ 派生層       … 部材インスタンス・BOM（常に①②から導出、保存しない）
 *
 * 単位は全て mm / kg。
 */

/* ========================================================================
 * ① 規格マスタ層（catalog）
 * ===================================================================== */

/** 足場システム（メーカー規格）。規格追加時はここに増やす */
export type ScaffoldSystem = 'albatross' | 'generic-wedge';

/** 長手方向スパン規格 */
export type SpanMM = 600 | 900 | 1200 | 1500 | 1800;

/** 短手（妻側）方向の足場幅規格 */
export type WidthMM = 450 | 600 | 900 | 1200;

/** 支柱の規格長 */
export type PillarMM = 450 | 900 | 1800 | 2700 | 3600;

/** くさびポケットのピッチ（層高さはこの倍数） */
export const LIFT_PITCH_MM = 450;

/** 部材種別 */
export type PartKind =
  | 'pillar'         // 支柱
  | 'ledger'         // 長手布材
  | 'transom'        // 短手布材（アンチ受け）
  | 'deck'           // アンチ（布板・踏板）
  | 'handrail'       // 長手手すり
  | 'brace'          // ブレス（筋交）
  | 'toeboard'       // 巾木
  | 'tsumaHandrail'  // 妻側手すり
  | 'tsumaToeboard'  // 妻側巾木
  | 'jackBase'       // ジャッキベース
  | 'stair'          // 階段
  | 'basePlate'      // 敷板
  | 'joint';         // タイコ等ジョイント

/** 部材規格（カタログの1行）。寸法・単重は規格として正確に持つ */
export interface PartSpec {
  id: string;              // 例: 'deck-1800-500'
  system: ScaffoldSystem;
  kind: PartKind;
  name: string;            // 例: 'アンチ1800/50'（既存 WEIGHT_DICT のキーと対応）
  lengthMm?: number;       // 長手方向寸法
  widthMm?: number;        // 短手方向寸法
  unitWeightKg: number;
}

export type PartCatalog = Record<string, PartSpec>;

/**
 * 【連動性の中核】スパン長 → 適合部材の対応表。
 * スパン変更時に手すり・ブレス・巾木・アンチが自動追従するのは
 * このルックアップをセレクタで毎回引くことで実現する。
 */
export interface SpanFittingRule {
  span: SpanMM;
  handrailSpecId: string;
  braceSpecId: string;
  toeboardSpecId: string;
  /** アンチはスパン×幅の2軸で決まる: 幅ごとの敷き並べ構成（メーカー差はデータで吸収） */
  deckLayoutByWidth: Record<WidthMM, string[]>;
}

/** 足場幅 → 妻側部材の対応表 */
export interface WidthFittingRule {
  width: WidthMM;
  transomSpecId: string;
  tsumaHandrailSpecId: string;
  tsumaToeboardSpecId: string;
}

/** システム一式のマスタ定義 */
export interface SystemCatalog {
  system: ScaffoldSystem;
  parts: PartCatalog;
  spanRules: Record<SpanMM, SpanFittingRule>;
  widthRules: Record<WidthMM, WidthFittingRule>;
  pillarLengths: PillarMM[];
}

/* ========================================================================
 * ② 配置層（Single Source of Truth — Zustand に保存するのはここだけ）
 *
 * 建物外周に沿う足場を「節点（支柱位置）＋辺（スパン）のグラフ」で表現する。
 * 隣接スパンが支柱を共有するため、Bay 配列ではなくグラフにするのが
 * 数量計算（支柱の重複排除）と入隅・出隅対応の両面で正しい。
 * ===================================================================== */

export interface Vec2 {
  x: number;
  y: number;
}

/** 節点 = 支柱の建て位置。グリッドスナップ済みの座標を持つ */
export interface PostNode {
  id: string;
  position: Vec2;
}

/** 辺 = 1スパン。パラメータのみ持ち、部材は持たない */
export interface SpanEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  span: SpanMM;      // 不変条件: |to - from| === span
  width: WidthMM;    // このスパンの足場幅
  side: 1 | -1;      // 進行方向に対しどちら側へ幅を取るか（建物の外側）
}

/** 1層（リフト）の構成。MVP では1層目のみだが最初から配列で持つ */
export interface Lift {
  index: number;        // 1層目 = 1
  heightMm: number;     // 通常 1800（LIFT_PITCH_MM の倍数）
  hasDeck: boolean;
  hasToeboard: boolean;
  handrail: 'both' | 'outerOnly' | 'none';
  hasStair: boolean;
}

/** ひと続きの足場ライン（将来は建物ごと・工区ごとに複数持てる） */
export interface ScaffoldRun {
  id: string;
  nodeIds: string[];     // 経路順
  edgeIds: string[];     // 経路順（nodeIds.length - 1 本）
  lifts: Lift[];         // MVP: 全スパン共通。将来 edge 単位で上書き可
  jackBase: 'SB20' | 'SB40';
  hasBasePlate: boolean;
}

/** プロジェクト全体（正規化して保持 → 部分更新・部分購読が速い） */
export interface ScaffoldProject {
  id: string;
  name: string;
  system: ScaffoldSystem;
  gridPitchMm: number;   // スナップグリッド（通常 300 か 150）
  nodes: Record<string, PostNode>;
  edges: Record<string, SpanEdge>;
  runs: Record<string, ScaffoldRun>;
}

/* ========================================================================
 * ③ 派生層（保存しない・常に resolveParts / aggregateBom で計算）
 * ===================================================================== */

/** 3D描画と数量集計の両方が使う中間表現 */
export interface PartInstance {
  specId: string;
  sourceEdgeId?: string;   // どのスパン由来か（選択ハイライト用）
  sourceNodeId?: string;
  liftIndex?: number;
  transform: {
    position: [number, number, number];
    rotationY: number;
  };
}

/** 数量表（BOM）の1行 */
export interface BomRow {
  specId: string;
  name: string;
  quantity: number;
  unitWeightKg: number;
  totalWeightKg: number;
}

export interface BillOfMaterials {
  rows: BomRow[];
  totalWeightKg: number;
}
