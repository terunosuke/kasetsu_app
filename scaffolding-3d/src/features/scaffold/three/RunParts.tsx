'use client';

/**
 * 1列（Run）分の足場を描画する。sub-alba の3D仕様に準拠。
 *
 * 高さのロジック:
 *   地面 → ジャッキベース（SB20=200 / SB40=400）→ 根がらみ支柱(+225) = ベース高さ
 *   ベース高さが「1段目の下端」。アンチは各段の下端に敷き、支柱はベース＋総高さまで。
 *   例: 3段・最上段900 → 1段目アンチ→1800→2段目アンチ→1800→3段目アンチ→900(頂部)
 *
 * 側面の構成（sideMode）:
 *   braceAndRail: 外面=先行手摺（×型・H900以内）／内面=二段手摺（H450+H900）
 *   bothRail:     両面とも二段手摺 ／ bothBrace: 両面とも先行手摺
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { DECK_PLACEMENT, WIDENING_WIDTH_MM, beamForOpening } from '../catalog/albatross';
import { effectivePillarCombo } from '../logic/bom';
import { pillarJointHeights } from '../model/fitting';
import {
  baseOffsetMm,
  cumulativeHeights,
  nodePoints,
  openingGroups,
  openingInteriorNodes,
  resolveAntiLevels,
  resolveStairLevels,
  resolveToeboardLevels,
  runLength,
  stairGroups,
  totalHeightMm,
  widenedBaySet,
  type GlobalSettings,
  type Run,
  type WidthMM,
} from '../model/types';
import type { SelectModifiers } from '../store/useScaffoldStore';

const M = 1 / 1000; // mm → m

// 視覚定数（m）
const LEG_R = 0.024;
const RAIL_R = 0.013;
const BRACE_R = 0.011;
const TRANSOM_R = 0.015;
const DECK_T = 0.045;
const DECK_LIFT = 0.05; // アンチは段下端から50mm上（短手布材の上）
const TOE_H = 0.15;

// 色
const C_LEG = '#5b7b9e';
const C_JACK = '#3a4654';
const C_NEGARAMI = '#8a949e';
const C_RAIL = '#e8762c';
const C_BRACE = '#9aa5af';
const C_DECK = '#c8ccd0';
const C_DECK_NARROW = '#b4bcc4';
const C_TOE = '#d9a62e';
const C_TRANSOM = '#6b7b8c';
const C_STAIR = '#808080';
const C_BEAM = '#b45309'; // 開口用梁（梁枠）
const C_JOINT = '#1a1a1a';
const C_WALLTIE = '#e02020';
const C_NET = '#00bfff';
const C_SHEET = '#3060c0';
const HIGHLIGHT = '#3b82f6';

const unitCylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const UP = new THREE.Vector3(0, 1, 0);

export interface Paint {
  opacity?: number; // 指定時は半透明（ゴースト描画用）
  tint?: string; // 指定時は全部材をこの色に
}

interface MatProps {
  color: string;
  transparent?: boolean;
  opacity?: number;
  depthWrite?: boolean;
}

function matProps(base: string, paint: Paint): MatProps {
  const color = paint.tint ?? base;
  if (paint.opacity !== undefined) {
    return { color, transparent: true, opacity: paint.opacity, depthWrite: false };
  }
  return { color };
}

type V3 = [number, number, number];
type P2 = { x: number; z: number };

/** 2点間に円柱を張る汎用部材 */
function Bar({ a, b, r, color, paint }: { a: V3; b: V3; r: number; color: string; paint: Paint }) {
  const { position, quaternion, length } = useMemo(() => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const d = vb.clone().sub(va);
    const length = d.length();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, d.normalize());
    const position = va.add(vb).multiplyScalar(0.5);
    return { position, quaternion, length };
  }, [a, b]);
  return (
    <mesh geometry={unitCylinder} position={position} quaternion={quaternion} scale={[r, length, r]}>
      <meshStandardMaterial {...matProps(color, paint)} />
    </mesh>
  );
}

function Box({
  center,
  size,
  color,
  paint,
  transparentOpacity,
}: {
  center: V3;
  size: V3;
  color: string;
  paint: Paint;
  /** 素材自体が半透明の部材（ネット・シート） */
  transparentOpacity?: number;
}) {
  const props = matProps(color, paint);
  if (transparentOpacity !== undefined && paint.opacity === undefined) {
    props.transparent = true;
    props.opacity = transparentOpacity;
    props.depthWrite = false;
  }
  return (
    <mesh geometry={unitBox} position={center} scale={size}>
      <meshStandardMaterial {...props} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** 階段フライト（sub-alba 準拠の踏み段列） */
function StairFlight({
  from,
  to,
  y0,
  y1,
  stepCount,
  paint,
}: {
  from: P2;
  to: P2;
  y0: number;
  y1: number;
  stepCount: number;
  paint: Paint;
}) {
  const alongX = Math.abs(to.x - from.x) > Math.abs(to.z - from.z);
  const totalLen = alongX ? Math.abs(to.x - from.x) : Math.abs(to.z - from.z);
  const clearance = 0.05;
  const usable = totalLen - clearance * 2;
  const stepDepth = usable / stepCount;
  const stepH = (y1 - y0) / stepCount;
  const stairW = 0.5;
  const steps = [];
  for (let i = 0; i < stepCount; i++) {
    const t = (clearance + i * stepDepth + stepDepth / 2) / totalLen;
    const x = from.x + (to.x - from.x) * t;
    const z = from.z + (to.z - from.z) * t;
    const y = y0 + (i + 0.5) * stepH;
    steps.push(
      <Box
        key={i}
        center={[x, y, z]}
        size={alongX ? [stepDepth * 0.92, 0.05, stairW] : [stairW, 0.05, stepDepth * 0.92]}
        color={C_STAIR}
        paint={paint}
      />,
    );
  }
  return <>{steps}</>;
}

/** 寸法ラベル（常にカメラ向き・操作を妨げない） */
function DimLabel({
  position,
  text,
  color,
}: {
  position: V3;
  text: string;
  color: string;
}) {
  return (
    <Html position={position} center style={{ pointerEvents: 'none' }} zIndexRange={[5, 0]}>
      <div
        className="whitespace-nowrap text-[11px] font-bold"
        style={{ color, textShadow: '0 0 3px #fff, 0 0 3px #fff' }}
      >
        {text}
      </div>
    </Html>
  );
}

/** 段のインデックス集合を all/alternate/custom(先頭N) で解決 */
function resolveLevelIndices(
  mode: 'all' | 'alternate' | 'custom',
  count: number,
  levels: number,
): number[] {
  if (mode === 'all') return Array.from({ length: levels }, (_, i) => i);
  if (mode === 'alternate') {
    const out = [];
    for (let i = 0; i < levels; i += 2) out.push(i);
    return out;
  }
  return Array.from({ length: Math.min(count, levels) }, (_, i) => i);
}

export function RunParts({
  run,
  settings,
  paint = {},
  selectedBayIds,
  onPickBay,
  onPickRun,
  onContextMenu,
}: {
  run: Pick<Run, 'origin' | 'bays' | 'width'>;
  settings: GlobalSettings;
  paint?: Paint;
  selectedBayIds?: Set<string> | null;
  onPickBay?: (bayId: string, mods: SelectModifiers) => void;
  /** ベイ以外の部材（支柱・短手布材など）をクリックしたときの列選択 */
  onPickRun?: () => void;
  /** 右クリック（画面座標つき） */
  onContextMenu?: (x: number, y: number, bayId: string | null) => void;
}) {
  const { levels } = settings;
  const w = run.width * M;
  const frontOff = -w / 2; // 中心線から見た内面（建物側・250アンチ側）建地ラインのオフセット
  const pts = useMemo(() => nodePoints(run).map((p) => ({ x: p.x * M, z: p.z * M })), [run]);

  // ===== 高さの計算（ベース＋各段下端の累積） =====
  const baseY = baseOffsetMm(settings) * M;
  const jackH = settings.jackBaseMode === 'none' ? 0 : (settings.jackBaseOption === 'allSB40' ? 400 : 200) * M;
  const cums = useMemo(() => cumulativeHeights(settings).map((v) => v * M), [settings]);
  const totalH = totalHeightMm(settings) * M;
  const legTop = baseY + totalH;
  /** 第 level 段（1-based）の下端 = アンチ敷設高さ */
  const deckY = (level: number) => baseY + cums[level - 1];

  const antiSet = useMemo(() => new Set(resolveAntiLevels(settings)), [settings]);
  const toeSet = useMemo(() => new Set(resolveToeboardLevels(settings)), [settings]);
  const stairLevelList = useMemo(() => resolveStairLevels(settings), [settings]);
  const toeFaces: number[] =
    settings.toeboardFaces === 'both' ? [-1, 1] : settings.toeboardFaces === 'single' ? [1] : [];

  // 支柱ジョイント位置
  const jointYs = useMemo(
    () =>
      pillarJointHeights(effectivePillarCombo(settings), totalHeightMm(settings)).map(
        (mm) => baseY + mm * M,
      ),
    [settings, baseY],
  );

  // ===== 開口部（梁枠） =====
  const oGroups = useMemo(() => openingGroups(run.bays), [run.bays]);
  const openingByBay = useMemo(() => {
    const m = new Map<number, number>(); // bayIdx → 開口の高さ（層数）
    for (const g of oGroups) {
      for (const bi of g.bayIndices) m.set(bi, Math.min(g.levels, levels));
    }
    return m;
  }, [oGroups, levels]);
  const interiorNodeLv = useMemo(() => {
    const m = new Map<number, number>(); // 開口内部の節点 → 開口の高さ（層数）
    for (const g of oGroups) {
      const oLv = Math.min(g.levels, levels);
      for (const n of openingInteriorNodes(g)) m.set(n, oLv);
    }
    return m;
  }, [oGroups, levels]);

  // ===== 階段セットと拡幅（sub-alba 準拠） =====
  const groups = useMemo(() => stairGroups(run.bays), [run.bays]);
  const widening = settings.stairWidening && run.width === 914;
  const { widenedBays, widenedNodes, outerNodes } = useMemo(() => {
    const widenedBays = widening ? widenedBaySet(run.bays) : new Set<number>();
    const widenedNodes = new Set<number>();
    const outerNodes = new Set<number>();
    if (widening) {
      for (let n = 0; n <= run.bays.length; n++) {
        if (widenedBays.has(n - 1) || widenedBays.has(n)) widenedNodes.add(n);
      }
      for (const g of groups) {
        outerNodes.add(Math.max(0, g[0] - 1));
        outerNodes.add(Math.min(run.bays.length, g[g.length - 1] + 2));
      }
    }
    return { widenedBays, widenedNodes, outerNodes };
  }, [widening, run.bays, groups]);

  const nodeWidthMm = (i: number): number => (widenedNodes.has(i) ? WIDENING_WIDTH_MM : run.width);
  const bayWidthMm = (bi: number): WidthMM =>
    (widenedBays.has(bi) ? WIDENING_WIDTH_MM : run.width) as WidthMM;

  /**
   * 千鳥のアンチ開口（`段(1-based):ベイindex`）。
   * 階段（第s段を登る）は第s+1段のアンチに到達するので、そこを開口する。
   * 2スパンセットは段ごとに交互（千鳥）、単独・余り段は先頭スパン。
   */
  const openings = useMemo(() => {
    const set = new Set<string>();
    const mark = (s: number, bi: number) => {
      if (s + 1 <= levels) set.add(`${s + 1}:${bi}`);
    };
    for (const g of groups) {
      if (g.length === 2) {
        let i = 0;
        while (i < stairLevelList.length - 1) {
          for (const s of [stairLevelList[i], stairLevelList[i + 1]]) {
            mark(s, (s - 1) % 2 === 0 ? g[0] : g[1]);
          }
          i += 2;
        }
        if (i < stairLevelList.length) mark(stairLevelList[i], g[0]);
      } else {
        for (const s of stairLevelList) mark(s, g[0]);
      }
    }
    return set;
  }, [groups, stairLevelList, levels]);

  const hasOpening = (level: number, bi: number): boolean => {
    if (!openings.has(`${level}:${bi}`)) return false;
    const effW = bayWidthMm(bi);
    return effW === 914 || effW >= 1219;
  };

  // オプション部材の設置段
  const tieLevels = useMemo(
    () =>
      settings.wallTieMode !== 'none'
        ? resolveLevelIndices(settings.wallTieLevelMode, settings.wallTieLevelCount, levels)
        : [],
    [settings, levels],
  );
  const netLevels = useMemo(
    () =>
      settings.layerNet
        ? resolveLevelIndices(settings.layerNetLevelMode, settings.layerNetLevelCount, levels)
        : [],
    [settings, levels],
  );
  const sheetUnits = useMemo(() => {
    if (!settings.sheet) return 0;
    const sheetLevels = settings.sheetLevelMode === 'all' ? levels : settings.sheetLevelCount;
    return Math.ceil(Math.max(0, sheetLevels) / 3);
  }, [settings, levels]);

  if (run.bays.length === 0) return null;

  const showDims = paint.opacity === undefined; // ゴースト時は寸法を出さない

  // 各節点における短手方向（進行方向に直交）
  const perpAt = (i: number): P2 => {
    const bay = run.bays[Math.min(i, run.bays.length - 1)];
    return { x: -bay.dir.z, z: bay.dir.x };
  };

  /** 節点 i の、内面ラインから d(mm) の位置（m座標） */
  const nodeAt = (i: number, dMm: number): P2 => {
    const p = pts[i];
    const perp = perpAt(i);
    const off = frontOff + dMm * M;
    return { x: p.x + perp.x * off, z: p.z + perp.z * off };
  };

  /** 建地1本。fromY を指定すると梁枠上から立ち上がる（ジャッキ・根がらみなし） */
  const Leg = ({ at, fromY = 0 }: { at: P2; fromY?: number }) => (
    <group>
      {fromY <= 0 && settings.jackBaseMode !== 'none' && (
        <>
          <Box center={[at.x, 0.015, at.z]} size={[0.16, 0.03, 0.16]} color={C_JACK} paint={paint} />
          <Bar a={[at.x, 0.03, at.z]} b={[at.x, jackH, at.z]} r={0.017} color={C_JACK} paint={paint} />
          {settings.negarami && (
            <Bar a={[at.x, jackH, at.z]} b={[at.x, baseY, at.z]} r={LEG_R} color={C_NEGARAMI} paint={paint} />
          )}
        </>
      )}
      {legTop - (fromY > 0 ? fromY : baseY) > 0.01 && (
        <Bar a={[at.x, fromY > 0 ? fromY : baseY, at.z]} b={[at.x, legTop, at.z]} r={LEG_R} color={C_LEG} paint={paint} />
      )}
      {/* 支柱ジョイント（黒い円盤） */}
      {jointYs
        .filter((jy) => jy > fromY + 0.01)
        .map((jy, ji) => (
          <mesh key={ji} geometry={unitCylinder} position={[at.x, jy, at.z]} scale={[0.11, 0.025, 0.11]}>
            <meshStandardMaterial {...matProps(C_JOINT, paint)} />
          </mesh>
        ))}
    </group>
  );

  return (
    <group
      onClick={
        onPickRun
          ? (e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              onPickRun();
            }
          : undefined
      }
      onContextMenu={
        onContextMenu
          ? (e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              e.nativeEvent.preventDefault();
              onContextMenu(e.nativeEvent.clientX, e.nativeEvent.clientY, null);
            }
          : undefined
      }
    >
      {/* ===== 節点ごと: 建地・短手布材・妻側部材・壁つなぎ（拡幅対応） ===== */}
      {pts.map((_, i) => {
        const nodeW = nodeWidthMm(i);
        const front = nodeAt(i, 0);
        const back = nodeAt(i, nodeW);
        const oLvNode = interiorNodeLv.get(i) ?? 0; // 開口内部節点の開口層数
        const legFromY = oLvNode > 0 ? baseY + cums[oLvNode] : 0;
        const isOuterWidened = widening && outerNodes.has(i) && widenedNodes.has(i);
        const mid914 = isOuterWidened ? nodeAt(i, 914) : null;
        const isTsumaEnd =
          (settings.tsumaCount >= 1 && i === 0) ||
          (settings.tsumaCount >= 2 && i === pts.length - 1);
        // 壁つなぎ: 設置スパン（節点）判定
        const tieHere =
          settings.wallTieMode !== 'none' &&
          (settings.wallTieSpanMode === 'all'
            ? true
            : settings.wallTieSpanMode === 'alternate'
              ? i % 2 === 0
              : i < settings.wallTieSpanCount);
        return (
          <group key={i}>
            <Leg at={front} fromY={legFromY} />
            <Leg at={back} fromY={legFromY} />
            {mid914 && <Leg at={mid914} />}
            {/* 短手布材（各段の下端）。拡幅の外列は 914 + 305 の2分割。開口内部は開口層なし */}
            {Array.from({ length: levels }, (_, li) => {
              if (li + 1 <= oLvNode) return null;
              const y = deckY(li + 1);
              return (
                <group key={li}>
                  {mid914 ? (
                    <>
                      <Bar a={[front.x, y, front.z]} b={[mid914.x, y, mid914.z]} r={TRANSOM_R} color={C_TRANSOM} paint={paint} />
                      <Bar a={[mid914.x, y, mid914.z]} b={[back.x, y, back.z]} r={TRANSOM_R} color={C_TRANSOM} paint={paint} />
                    </>
                  ) : (
                    <Bar a={[front.x, y, front.z]} b={[back.x, y, back.z]} r={TRANSOM_R} color={C_TRANSOM} paint={paint} />
                  )}
                </group>
              );
            })}
            {/* 妻側手すり・妻側巾木（アンチ設置段の下端基準） */}
            {isTsumaEnd &&
              Array.from({ length: levels }, (_, li) =>
                antiSet.has(li + 1) ? (
                  <group key={li}>
                    <Bar a={[front.x, deckY(li + 1) + 0.45, front.z]} b={[back.x, deckY(li + 1) + 0.45, back.z]} r={RAIL_R} color={C_RAIL} paint={paint} />
                    <Bar a={[front.x, deckY(li + 1) + 0.9, front.z]} b={[back.x, deckY(li + 1) + 0.9, back.z]} r={RAIL_R} color={C_RAIL} paint={paint} />
                    <Box
                      center={[(front.x + back.x) / 2, deckY(li + 1) + DECK_LIFT + DECK_T + TOE_H / 2, (front.z + back.z) / 2]}
                      size={[Math.abs(back.x - front.x) || 0.015, TOE_H, Math.abs(back.z - front.z) || 0.015]}
                      color={C_TOE}
                      paint={paint}
                    />
                  </group>
                ) : null,
              )}
            {/* 壁つなぎ（内面＝建物側、段の中間高さに赤球） */}
            {tieHere &&
              tieLevels.filter((li) => li >= oLvNode).map((li) => (
                <mesh
                  key={`tie-${li}`}
                  position={[front.x, baseY + (cums[li] + cums[li + 1]) / 2, front.z]}
                >
                  <sphereGeometry args={[0.08, 12, 12]} />
                  <meshStandardMaterial {...matProps(C_WALLTIE, paint)} />
                </mesh>
              ))}
          </group>
        );
      })}

      {/* ===== ベイ（スパン）ごと ===== */}
      {run.bays.map((bay, bi) => {
        const a = pts[bi];
        const b = pts[bi + 1];
        const spanLen = bay.span * M;
        const alongX = bay.dir.z === 0;
        const perp = { x: -bay.dir.z, z: bay.dir.x };
        const isSelected = selectedBayIds?.has(bay.id) ?? false;
        const bayPaint: Paint = isSelected && paint.opacity === undefined ? { tint: HIGHLIGHT } : paint;
        const bayOLv = openingByBay.get(bi) ?? 0; // 開口部（梁枠）の高さ（層数）
        const effW = bayWidthMm(bi);
        const placements = DECK_PLACEMENT[effW];
        const backOffMm = effW;
        const lineAt = (dMm: number) => {
          const off = frontOff + dMm * M;
          return {
            a: { x: a.x + perp.x * off, z: a.z + perp.z * off },
            b: { x: b.x + perp.x * off, z: b.z + perp.z * off },
          };
        };
        const frontLine = lineAt(0);
        const backLine = lineAt(backOffMm);
        const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };

        // 側面構成: 面ごとに ブレス(×) or 二段手摺
        const faceIsBrace = (side: 1 | -1): boolean =>
          settings.sideMode === 'bothBrace' ||
          (settings.sideMode === 'braceAndRail' && side === 1); // 外面(+)=ブレス

        return (
          <group
            key={bay.id}
            onClick={
              onPickBay
                ? (e: ThreeEvent<MouseEvent>) => {
                    e.stopPropagation();
                    onPickBay(bay.id, {
                      shift: e.nativeEvent.shiftKey,
                      ctrl: e.nativeEvent.ctrlKey || e.nativeEvent.metaKey,
                    });
                  }
                : undefined
            }
            onContextMenu={
              onContextMenu
                ? (e: ThreeEvent<MouseEvent>) => {
                    e.stopPropagation();
                    e.nativeEvent.preventDefault();
                    onContextMenu(e.nativeEvent.clientX, e.nativeEvent.clientY, bay.id);
                  }
                : undefined
            }
          >
            {Array.from({ length: levels }, (_, li) => {
              const level = li + 1;
              const y0 = deckY(level); // 段の下端
              const hasDeck = antiSet.has(level);
              const hasToe = toeSet.has(level);
              const opening = hasDeck && hasOpening(level, bi);
              if (level <= bayOLv) return null; // 開口部: この層は部材なし（梁枠のみ）
              return (
                <group key={li}>
                  {/* アンチ（段の下端に敷設。開口時はブレス側500を抜く） */}
                  {hasDeck &&
                    placements.map((pl, pi) => {
                      if (opening && pi === placements.length - 1) return null;
                      const line = lineAt(pl.centerMm);
                      const cx = (line.a.x + line.b.x) / 2;
                      const cz = (line.a.z + line.b.z) / 2;
                      const dw = pl.widthMm * M;
                      return (
                        <Box
                          key={pi}
                          center={[cx, y0 + DECK_LIFT + DECK_T / 2, cz]}
                          size={alongX ? [spanLen * 0.97, DECK_T, dw] : [dw, DECK_T, spanLen * 0.97]}
                          color={pl.widthMm <= 250 ? C_DECK_NARROW : C_DECK}
                          paint={bayPaint}
                        />
                      );
                    })}
                  {/* 側面（内面-1 / 外面+1） */}
                  {([-1, 1] as const).map((side) => {
                    const line = side === -1 ? frontLine : backLine;
                    if (faceIsBrace(side)) {
                      // 先行手摺: ×型（H900以内）※階段スパンの外面のみ省略しない=sub-alba同様表示
                      return (
                        <group key={side}>
                          <Bar a={[line.a.x, y0 + 0.05, line.a.z]} b={[line.b.x, y0 + 0.9, line.b.z]} r={BRACE_R} color={C_BRACE} paint={bayPaint} />
                          <Bar a={[line.b.x, y0 + 0.05, line.b.z]} b={[line.a.x, y0 + 0.9, line.a.z]} r={BRACE_R} color={C_BRACE} paint={bayPaint} />
                        </group>
                      );
                    }
                    // 二段手摺: H450 + H900
                    return (
                      <group key={side}>
                        <Bar a={[line.a.x, y0 + 0.45, line.a.z]} b={[line.b.x, y0 + 0.45, line.b.z]} r={RAIL_R} color={C_RAIL} paint={bayPaint} />
                        <Bar a={[line.a.x, y0 + 0.9, line.a.z]} b={[line.b.x, y0 + 0.9, line.b.z]} r={RAIL_R} color={C_RAIL} paint={bayPaint} />
                      </group>
                    );
                  })}
                  {/* 巾木 */}
                  {hasToe &&
                    toeFaces.map((side) => {
                      const line = lineAt(side === -1 ? 12 : backOffMm - 12);
                      const cx = (line.a.x + line.b.x) / 2;
                      const cz = (line.a.z + line.b.z) / 2;
                      return (
                        <Box
                          key={side}
                          center={[cx, y0 + DECK_LIFT + DECK_T + TOE_H / 2, cz]}
                          size={alongX ? [spanLen * 0.98, TOE_H, 0.015] : [0.015, TOE_H, spanLen * 0.98]}
                          color={C_TOE}
                          paint={bayPaint}
                        />
                      );
                    })}
                  {/* 層間ネット（内面から建物側へ300mm跳ね出し・段の上端） */}
                  {netLevels.includes(li) && (
                    <Box
                      center={[
                        mid.x + perp.x * (frontOff - 0.15),
                        baseY + cums[li + 1],
                        mid.z + perp.z * (frontOff - 0.15),
                      ]}
                      size={alongX ? [spanLen, 0.01, 0.3] : [0.3, 0.01, spanLen]}
                      color={C_NET}
                      paint={paint}
                      transparentOpacity={0.5}
                    />
                  )}
                </group>
              );
            })}
            {/* 外周メッシュシート（外面・5400mm単位で積む） */}
            {Array.from({ length: sheetUnits }, (_, si) => {
              const unitH = 5.4;
              const sheetBase = bayOLv > 0 ? baseY + cums[bayOLv] : baseY; // 開口ベイは梁枠上から
              const bottom = Math.max(baseY + si * unitH, sheetBase);
              const top = Math.min(baseY + si * unitH + unitH, legTop);
              if (top - bottom <= 0.01) return null;
              const line = lineAt(backOffMm + 40);
              const cx = (line.a.x + line.b.x) / 2;
              const cz = (line.a.z + line.b.z) / 2;
              return (
                <Box
                  key={`sheet-${si}`}
                  center={[cx, (bottom + top) / 2, cz]}
                  size={alongX ? [spanLen, top - bottom, 0.006] : [0.006, top - bottom, spanLen]}
                  color={C_SHEET}
                  paint={paint}
                  transparentOpacity={0.3}
                />
              );
            })}
            {/* スパン寸法（地面・内面側） */}
            {showDims && (
              <DimLabel
                position={[
                  mid.x + perp.x * (frontOff - 0.5),
                  0.02,
                  mid.z + perp.z * (frontOff - 0.5),
                ]}
                text={`${bay.span}`}
                color="#d02020"
              />
            )}
          </group>
        );
      })}

      {/* ===== 妻側メッシュシート（列の端部） ===== */}
      {settings.sheet &&
        settings.tsumaSheetCount > 0 &&
        [0, pts.length - 1]
          .filter((_, k) => (k === 0 ? settings.tsumaSheetCount >= 1 : settings.tsumaSheetCount >= 2))
          .map((ni) => {
            const nodeW = nodeWidthMm(ni);
            const front = nodeAt(ni, -40);
            const back = nodeAt(ni, nodeW + 40);
            const cx = (front.x + back.x) / 2;
            const cz = (front.z + back.z) / 2;
            const depth = Math.hypot(back.x - front.x, back.z - front.z);
            const bay = run.bays[Math.min(ni, run.bays.length - 1)];
            const alongX = bay.dir.z === 0;
            return Array.from({ length: sheetUnits }, (_, si) => {
              const unitH = 5.4;
              const bottom = baseY + si * unitH;
              const top = Math.min(bottom + unitH, legTop);
              if (top - bottom <= 0.01) return null;
              return (
                <Box
                  key={`tsheet-${ni}-${si}`}
                  center={[cx, (bottom + top) / 2, cz]}
                  size={alongX ? [0.006, top - bottom, depth] : [depth, top - bottom, 0.006]}
                  color={C_SHEET}
                  paint={paint}
                  transparentOpacity={0.3}
                />
              );
            });
          })}

      {/* ===== 開口部（梁枠）: 開口上端に両構面トラス梁 ===== */}
      {oGroups.map((g, gi) => {
        const oLv = Math.min(g.levels, levels);
        const beam = beamForOpening(g.lengthMm);
        const topY = baseY + cums[oLv];
        const botY = topY - beam.heightMm * M;
        const startN = g.bayIndices[0];
        const endN = g.bayIndices[g.bayIndices.length - 1] + 1;
        const firstBay = run.bays[g.bayIndices[0]];
        const faces = [0, run.width]; // 両構面
        const groundMid = (() => {
          const pa = pts[startN];
          const pb = pts[endN];
          return { x: (pa.x + pb.x) / 2, z: (pa.z + pb.z) / 2 };
        })();
        return (
          <group
            key={`beam-${gi}`}
            onClick={
              onPickBay
                ? (e: ThreeEvent<MouseEvent>) => {
                    e.stopPropagation();
                    onPickBay(firstBay.id, {
                      shift: e.nativeEvent.shiftKey,
                      ctrl: e.nativeEvent.ctrlKey || e.nativeEvent.metaKey,
                    });
                  }
                : undefined
            }
          >
            {faces.map((dMm, fi) => {
              const pA = (() => { const p = pts[startN]; const perp = perpAt(startN === run.bays.length ? startN - 1 : startN); const off = frontOff + dMm * M; return { x: p.x + perp.x * off, z: p.z + perp.z * off }; })();
              const pB = (() => { const p = pts[endN]; const perp = perpAt(endN > 0 ? endN - 1 : 0); const off = frontOff + dMm * M; return { x: p.x + perp.x * off, z: p.z + perp.z * off }; })();
              const segs = Math.max(3, Math.round(g.lengthMm / 900));
              const at = (t: number) => ({ x: pA.x + (pB.x - pA.x) * t, z: pA.z + (pB.z - pA.z) * t });
              const items = [];
              // 上弦・下弦
              items.push(<Bar key="tc" a={[pA.x, topY, pA.z]} b={[pB.x, topY, pB.z]} r={0.022} color={C_BEAM} paint={paint} />);
              items.push(<Bar key="bc" a={[pA.x, botY, pA.z]} b={[pB.x, botY, pB.z]} r={0.022} color={C_BEAM} paint={paint} />);
              // 縦材＋斜材（ラチス）
              for (let k = 0; k <= segs; k++) {
                const p = at(k / segs);
                items.push(<Bar key={`v${k}`} a={[p.x, botY, p.z]} b={[p.x, topY, p.z]} r={0.012} color={C_BEAM} paint={paint} />);
                if (k < segs) {
                  const pn = at((k + 1) / segs);
                  const up = k % 2 === 0;
                  items.push(
                    <Bar
                      key={`d${k}`}
                      a={[p.x, up ? botY : topY, p.z]}
                      b={[pn.x, up ? topY : botY, pn.z]}
                      r={0.01}
                      color={C_BEAM}
                      paint={paint}
                    />,
                  );
                }
              }
              return <group key={fi}>{items}</group>;
            })}
            {/* 開口寸法ラベル */}
            {showDims && (
              <DimLabel
                position={[groundMid.x, 0.25, groundMid.z]}
                text={`開口${g.lengthMm.toLocaleString()}（${beam.name.replace('梁枠（', '').replace('）', '')}）`}
                color="#b45309"
              />
            )}
          </group>
        );
      })}

      {/* ===== 階段（セットごと: 2スパン=斜め型 / 1スパン=垂直型） ===== */}
      {groups.map((g, gi) => {
        const firstBay = run.bays[g[0]];
        const effW = bayWidthMm(g[0]);
        const pls = DECK_PLACEMENT[effW];
        const stairCenterMm = pls[pls.length - 1].centerMm;
        const lineEnd = (nodeIdx: number, bayIdx: number): P2 => {
          const p = pts[nodeIdx];
          const perp = perpAt(bayIdx);
          const off = frontOff + stairCenterMm * M;
          return { x: p.x + perp.x * off, z: p.z + perp.z * off };
        };
        const flights = [];

        if (g.length === 2) {
          let i = 0;
          while (i < stairLevelList.length - 1) {
            const s1 = stairLevelList[i];
            const s2 = stairLevelList[i + 1];
            flights.push(
              <StairFlight
                key={`d${i}`}
                from={lineEnd(g[0], g[0])}
                to={lineEnd(g[1] + 1, g[1])}
                y0={deckY(s1)}
                y1={deckY(Math.min(s2 + 1, levels + 1))}
                stepCount={16}
                paint={paint}
              />,
            );
            i += 2;
          }
          if (i < stairLevelList.length) {
            const s = stairLevelList[i];
            flights.push(
              <StairFlight
                key={`v${i}`}
                from={lineEnd(g[0], g[0])}
                to={lineEnd(g[0] + 1, g[0])}
                y0={deckY(s)}
                y1={deckY(Math.min(s + 1, levels + 1))}
                stepCount={8}
                paint={paint}
              />,
            );
          }
        } else {
          for (const s of stairLevelList) {
            flights.push(
              <StairFlight
                key={`v${s}`}
                from={lineEnd(g[0], g[0])}
                to={lineEnd(g[0] + 1, g[0])}
                y0={deckY(s)}
                y1={deckY(Math.min(s + 1, levels + 1))}
                stepCount={8}
                paint={paint}
              />,
            );
          }
        }

        return (
          <group
            key={`stair-${gi}`}
            onClick={
              onPickBay
                ? (e: ThreeEvent<MouseEvent>) => {
                    e.stopPropagation();
                    onPickBay(firstBay.id, {
                      shift: e.nativeEvent.shiftKey,
                      ctrl: e.nativeEvent.ctrlKey || e.nativeEvent.metaKey,
                    });
                  }
                : undefined
            }
          >
            {flights}
          </group>
        );
      })}

      {/* ===== 枠幅・拡幅の寸法表示（列の始端の手前） ===== */}
      {showDims &&
        (() => {
          const p0 = pts[0];
          const d0 = run.bays[0].dir;
          const labelPos: V3 = [p0.x - d0.x * 0.9, 0.8, p0.z - d0.z * 0.9];
          return (
            <group>
              <DimLabel position={labelPos} text={`${run.width}枠`} color="#2040d0" />
              {widening && (
                <DimLabel
                  position={[labelPos[0], 1.15, labelPos[2]]}
                  text="階段部1219拡幅"
                  color="#e08000"
                />
              )}
              <DimLabel
                position={[p0.x - d0.x * 0.9, 0.45, p0.z - d0.z * 0.9]}
                text={`全長${runLength(run).toLocaleString()}`}
                color="#d02020"
              />
            </group>
          );
        })()}
    </group>
  );
}
