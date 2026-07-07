'use client';

/**
 * 1列（Run）分の足場を描画する。
 * 部材単位の寸法・配置は sub-alba の3D仕様（ScaffoldingVisualizer3D）に準拠:
 *   - アンチ敷き並べ: 枠幅ごとに 400 / 500 / 250+500 / 500×2 を実寸クリアで配置
 *   - 階段: 連続2スパン = 斜め型（2段を一気に登る）、単独1スパン = 垂直型。
 *     ブレス側500幅アンチの位置に載り、直上のアンチを段ごとに千鳥で1枚抜く
 *   - 拡幅（枠幅914のみ）: 階段セット＋両隣の計5列が1219幅に拡がり、
 *     外2列の914ラインに追加建地＋短手布材305が入る
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { DECK_PLACEMENT, WIDENING_WIDTH_MM } from '../catalog/albatross';
import {
  liftHeights,
  nodePoints,
  resolveAntiLevels,
  resolveStairLevels,
  resolveToeboardLevels,
  stairGroups,
  widenedBaySet,
  type GlobalSettings,
  type Run,
  type WidthMM,
} from '../model/types';

const M = 1 / 1000; // mm → m

// 視覚定数（m）
const BASE_H = 0.3; // ジャッキベース高さ（この上に支柱が立つ）
const LEG_R = 0.024;
const RAIL_R = 0.013;
const BRACE_R = 0.011;
const TRANSOM_R = 0.015;
const DECK_T = 0.045;
const TOE_H = 0.15;

// 色
const C_LEG = '#5b7b9e';
const C_JACK = '#3a4654';
const C_RAIL = '#e8762c';
const C_BRACE = '#9aa5af';
const C_DECK = '#c8ccd0';
const C_DECK_NARROW = '#b4bcc4'; // 250幅アンチ（見分け用にわずかに濃く）
const C_TOE = '#d9a62e';
const C_TRANSOM = '#6b7b8c';
const C_STAIR = '#808080';
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
}: {
  center: V3;
  size: V3;
  color: string;
  paint: Paint;
}) {
  return (
    <mesh geometry={unitBox} position={center} scale={size}>
      <meshStandardMaterial {...matProps(color, paint)} />
    </mesh>
  );
}

/**
 * 階段フライト（sub-alba 準拠の踏み段列）。
 * from（平面座標・m）から to へ向かって y0 → y1 に登る。
 */
function StairFlight({
  from,
  to,
  y0,
  y1,
  stepCount,
  paint,
}: {
  from: { x: number; z: number };
  to: { x: number; z: number };
  y0: number;
  y1: number;
  stepCount: number;
  paint: Paint;
}) {
  const alongX = Math.abs(to.x - from.x) > Math.abs(to.z - from.z);
  const totalLen = alongX ? Math.abs(to.x - from.x) : Math.abs(to.z - from.z);
  const clearance = 0.05; // 縦枠とのクリア50mm
  const usable = totalLen - clearance * 2;
  const stepDepth = usable / stepCount;
  const stepH = (y1 - y0) / stepCount;
  const stairW = 0.5; // 階段の幅500mm
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

export function RunParts({
  run,
  settings,
  paint = {},
  selectedBayId = null,
  onPickBay,
  onPickRun,
}: {
  run: Pick<Run, 'origin' | 'bays' | 'width'>;
  settings: GlobalSettings;
  paint?: Paint;
  selectedBayId?: string | null;
  onPickBay?: (bayId: string) => void;
  /** ベイ以外の部材（支柱・短手布材など）をクリックしたときの列選択 */
  onPickRun?: () => void;
}) {
  const { levels } = settings;
  const w = run.width * M;
  const frontOff = -w / 2; // 中心線から見た手前（250側）建地ラインのオフセット
  const pts = useMemo(() => nodePoints(run).map((p) => ({ x: p.x * M, z: p.z * M })), [run]);

  // 段ごとのデッキ高さ（累積・最上段900対応）
  const { deckYs, legTop } = useMemo(() => {
    const heights = liftHeights(settings);
    const ys: number[] = [];
    let acc = BASE_H;
    for (const h of heights) {
      acc += h * M;
      ys.push(acc);
    }
    return { deckYs: ys, legTop: acc + 0.95 };
  }, [settings]);

  const antiSet = useMemo(() => new Set(resolveAntiLevels(settings)), [settings]);
  const toeSet = useMemo(() => new Set(resolveToeboardLevels(settings)), [settings]);
  const stairLevelList = useMemo(() => resolveStairLevels(settings), [settings]);
  const toeFaces: number[] =
    settings.toeboardFaces === 'both' ? [-1, 1] : settings.toeboardFaces === 'single' ? [1] : [];

  // ===== 階段セットと拡幅の計算（sub-alba 準拠） =====
  const groups = useMemo(() => stairGroups(run.bays), [run.bays]);
  const widening = settings.stairWidening && run.width === 914;
  const { widenedBays, widenedNodes, outerNodes } = useMemo(() => {
    const widenedBays = widening ? widenedBaySet(run.bays) : new Set<number>();
    const widenedNodes = new Set<number>();
    const outerNodes = new Set<number>(); // 914ラインに追加建地が立つ外列
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

  const nodeWidthMm = (i: number): number =>
    widenedNodes.has(i) ? WIDENING_WIDTH_MM : run.width;
  const bayWidthMm = (bi: number): WidthMM =>
    (widenedBays.has(bi) ? WIDENING_WIDTH_MM : run.width) as WidthMM;

  /**
   * 千鳥のアンチ開口の位置（`デッキindex:ベイindex`）。
   * 階段の登り切り床でブレス側500幅アンチを1枚抜く。
   * 2スパンセットは段ごとに 1スパン目/2スパン目を交互に（千鳥）、
   * 単独スパン・余り段はそのスパンを抜く（sub-alba 準拠）。
   */
  const openings = useMemo(() => {
    const set = new Set<string>();
    for (const g of groups) {
      if (g.length === 2) {
        let i = 0;
        while (i < stairLevelList.length - 1) {
          for (const s of [stairLevelList[i], stairLevelList[i + 1]]) {
            set.add(`${s - 1}:${(s - 1) % 2 === 0 ? g[0] : g[1]}`);
          }
          i += 2;
        }
        if (i < stairLevelList.length) set.add(`${stairLevelList[i] - 1}:${g[0]}`);
      } else {
        for (const s of stairLevelList) set.add(`${s - 1}:${g[0]}`);
      }
    }
    return set;
  }, [groups, stairLevelList]);

  const hasOpening = (li: number, bi: number): boolean => {
    if (!openings.has(`${li}:${bi}`)) return false;
    const effW = bayWidthMm(bi);
    return effW === 914 || effW >= 1219; // sub-alba は 914/1219 のみ開口
  };

  if (run.bays.length === 0) return null;

  // 各節点における短手方向（進行方向に直交）を求める。
  // 角の節点は前後どちらかのベイの向きを使う（視覚上の簡略化）。
  const perpAt = (i: number): { x: number; z: number } => {
    const bay = run.bays[Math.min(i, run.bays.length - 1)];
    return { x: -bay.dir.z, z: bay.dir.x };
  };

  /** 節点 i の、手前ラインから d(mm) の位置（m座標） */
  const nodeAt = (i: number, dMm: number): { x: number; z: number } => {
    const p = pts[i];
    const perp = perpAt(i);
    const off = frontOff + dMm * M;
    return { x: p.x + perp.x * off, z: p.z + perp.z * off };
  };

  /** 建地1本（ジャッキベース＋支柱） */
  const Leg = ({ at }: { at: { x: number; z: number } }) => (
    <group>
      {settings.jackBaseMode !== 'none' && (
        <>
          <Box center={[at.x, 0.02, at.z]} size={[0.13, 0.04, 0.13]} color={C_JACK} paint={paint} />
          <Bar a={[at.x, 0.04, at.z]} b={[at.x, BASE_H, at.z]} r={0.017} color={C_JACK} paint={paint} />
        </>
      )}
      <Bar a={[at.x, BASE_H, at.z]} b={[at.x, legTop, at.z]} r={LEG_R} color={C_LEG} paint={paint} />
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
    >
      {/* ===== 節点ごと: 建地・短手布材・妻側部材（拡幅対応） ===== */}
      {pts.map((_, i) => {
        const nodeW = nodeWidthMm(i);
        const front = nodeAt(i, 0);
        const back = nodeAt(i, nodeW);
        const isOuterWidened = widening && outerNodes.has(i) && widenedNodes.has(i);
        const mid914 = isOuterWidened ? nodeAt(i, 914) : null;
        // 妻側: 0面=なし / 1面=始端のみ / 2面=両端
        const isTsumaEnd =
          (settings.tsumaCount >= 1 && i === 0) ||
          (settings.tsumaCount >= 2 && i === pts.length - 1);
        return (
          <group key={i}>
            <Leg at={front} />
            <Leg at={back} />
            {/* 拡幅の外列: 914ラインに追加建地 */}
            {mid914 && <Leg at={mid914} />}
            {/* 短手布材（各段のアンチ受け）。外列は 914 + 305 の2分割 */}
            {deckYs.map((y, li) => (
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
            ))}
            {/* 妻側手すり・妻側巾木（アンチ設置段に付く） */}
            {isTsumaEnd &&
              deckYs.map((deckY, li) =>
                antiSet.has(li + 1) ? (
                  <group key={li}>
                    <Bar a={[front.x, deckY + 0.45, front.z]} b={[back.x, deckY + 0.45, back.z]} r={RAIL_R} color={C_RAIL} paint={paint} />
                    <Bar a={[front.x, deckY + 0.9, front.z]} b={[back.x, deckY + 0.9, back.z]} r={RAIL_R} color={C_RAIL} paint={paint} />
                    <Box
                      center={[(front.x + back.x) / 2, deckY + TOE_H / 2 + DECK_T, (front.z + back.z) / 2]}
                      size={[Math.abs(back.x - front.x) || 0.015, TOE_H, Math.abs(back.z - front.z) || 0.015]}
                      color={C_TOE}
                      paint={paint}
                    />
                  </group>
                ) : null,
              )}
          </group>
        );
      })}

      {/* ===== ベイ（スパン）ごと: アンチ・手すり・ブレス・巾木 ===== */}
      {run.bays.map((bay, bi) => {
        const a = pts[bi];
        const b = pts[bi + 1];
        const spanLen = bay.span * M;
        const alongX = bay.dir.z === 0; // スパンが X 軸方向か
        const perp = { x: -bay.dir.z, z: bay.dir.x };
        const bayPaint: Paint =
          selectedBayId === bay.id && paint.opacity === undefined ? { tint: HIGHLIGHT } : paint;
        const effW = bayWidthMm(bi);
        const placements = DECK_PLACEMENT[effW];
        const backOffMm = effW; // このベイの奥側（ブレス側）ライン
        /** ベイ内で手前ラインから d(mm) オフセットした2点 */
        const lineAt = (dMm: number) => {
          const off = frontOff + dMm * M;
          return {
            a: { x: a.x + perp.x * off, z: a.z + perp.z * off },
            b: { x: b.x + perp.x * off, z: b.z + perp.z * off },
          };
        };

        return (
          <group
            key={bay.id}
            onClick={
              onPickBay
                ? (e: ThreeEvent<MouseEvent>) => {
                    e.stopPropagation();
                    onPickBay(bay.id);
                  }
                : undefined
            }
          >
            {deckYs.map((deckY, li) => {
              const level = li + 1;
              const y0 = li === 0 ? BASE_H : deckYs[li - 1];
              const hasDeck = antiSet.has(level);
              const hasToe = toeSet.has(level);
              const opening = hasDeck && hasOpening(li, bi);
              const frontLine = lineAt(0);
              const backLine = lineAt(backOffMm);
              return (
                <group key={li}>
                  {/* アンチ（枠幅ごとの正確な敷き並べ。開口時はブレス側500を抜く） */}
                  {hasDeck &&
                    placements.map((pl, pi) => {
                      if (opening && pi === placements.length - 1) return null; // 千鳥開口
                      const line = lineAt(pl.centerMm);
                      const cx = (line.a.x + line.b.x) / 2;
                      const cz = (line.a.z + line.b.z) / 2;
                      const dw = pl.widthMm * M;
                      return (
                        <Box
                          key={pi}
                          center={[cx, deckY + DECK_T / 2, cz]}
                          size={alongX ? [spanLen * 0.97, DECK_T, dw] : [dw, DECK_T, spanLen * 0.97]}
                          color={pl.widthMm <= 250 ? C_DECK_NARROW : C_DECK}
                          paint={bayPaint}
                        />
                      );
                    })}
                  {/* 長手手すり（手前・奥 各1本） */}
                  {[frontLine, backLine].map((line, k) => (
                    <Bar
                      key={k}
                      a={[line.a.x, deckY + 0.9, line.a.z]}
                      b={[line.b.x, deckY + 0.9, line.b.z]}
                      r={RAIL_R}
                      color={C_RAIL}
                      paint={bayPaint}
                    />
                  ))}
                  {/* ブレス（奥側・段ごとに向き交互）※階段スパンには表示しない */}
                  {!bay.isStair && (
                    <Bar
                      a={[
                        level % 2 === 1 ? backLine.a.x : backLine.b.x,
                        y0 + 0.1,
                        level % 2 === 1 ? backLine.a.z : backLine.b.z,
                      ]}
                      b={[
                        level % 2 === 1 ? backLine.b.x : backLine.a.x,
                        deckY - 0.1,
                        level % 2 === 1 ? backLine.b.z : backLine.a.z,
                      ]}
                      r={BRACE_R}
                      color={C_BRACE}
                      paint={bayPaint}
                    />
                  )}
                  {/* 巾木（面数設定に応じて手前/奥） */}
                  {hasToe &&
                    toeFaces.map((side) => {
                      const line = lineAt(side === -1 ? 12 : backOffMm - 12);
                      const cx = (line.a.x + line.b.x) / 2;
                      const cz = (line.a.z + line.b.z) / 2;
                      return (
                        <Box
                          key={side}
                          center={[cx, deckY + DECK_T + TOE_H / 2, cz]}
                          size={alongX ? [spanLen * 0.98, TOE_H, 0.015] : [0.015, TOE_H, spanLen * 0.98]}
                          color={C_TOE}
                          paint={bayPaint}
                        />
                      );
                    })}
                </group>
              );
            })}
          </group>
        );
      })}

      {/* ===== 階段（セットごと: 2スパン=斜め型 / 1スパン=垂直型） ===== */}
      {groups.map((g, gi) => {
        const firstBay = run.bays[g[0]];
        const effW = bayWidthMm(g[0]);
        // 階段はブレス側500幅アンチの位置に載る（914:614 / 1219:919 / その他:最奥アンチ中心）
        const pls = DECK_PLACEMENT[effW];
        const stairCenterMm = pls[pls.length - 1].centerMm;
        const flights = [];

        if (g.length === 2) {
          // 斜め型: 階段設置段を2段ずつペアにして、2スパンで一気に登る
          let i = 0;
          while (i < stairLevelList.length - 1) {
            const s1 = stairLevelList[i];
            const s2 = stairLevelList[i + 1];
            const from = (() => {
              const p = pts[g[0]];
              const perp = perpAt(g[0]);
              const off = frontOff + stairCenterMm * M;
              return { x: p.x + perp.x * off, z: p.z + perp.z * off };
            })();
            const to = (() => {
              const p = pts[g[1] + 1];
              const perp = perpAt(g[1]);
              const off = frontOff + stairCenterMm * M;
              return { x: p.x + perp.x * off, z: p.z + perp.z * off };
            })();
            flights.push(
              <StairFlight
                key={`d${i}`}
                from={from}
                to={to}
                y0={s1 === 1 ? BASE_H : deckYs[s1 - 2]}
                y1={deckYs[s2 - 1]}
                stepCount={16}
                paint={paint}
              />,
            );
            i += 2;
          }
          // 余った段は垂直型（1スパン目）
          if (i < stairLevelList.length) {
            const s = stairLevelList[i];
            const from = nodeAt(g[0], stairCenterMm);
            const to = (() => {
              const p = pts[g[0] + 1];
              const perp = perpAt(g[0]);
              const off = frontOff + stairCenterMm * M;
              return { x: p.x + perp.x * off, z: p.z + perp.z * off };
            })();
            flights.push(
              <StairFlight
                key={`v${i}`}
                from={from}
                to={to}
                y0={s === 1 ? BASE_H : deckYs[s - 2]}
                y1={deckYs[s - 1]}
                stepCount={8}
                paint={paint}
              />,
            );
          }
        } else {
          // 垂直型: 各設置段に1フライト
          for (const s of stairLevelList) {
            const from = nodeAt(g[0], stairCenterMm);
            const to = (() => {
              const p = pts[g[0] + 1];
              const perp = perpAt(g[0]);
              const off = frontOff + stairCenterMm * M;
              return { x: p.x + perp.x * off, z: p.z + perp.z * off };
            })();
            flights.push(
              <StairFlight
                key={`v${s}`}
                from={from}
                to={to}
                y0={s === 1 ? BASE_H : deckYs[s - 2]}
                y1={deckYs[s - 1]}
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
                    onPickBay(firstBay.id);
                  }
                : undefined
            }
          >
            {flights}
          </group>
        );
      })}
    </group>
  );
}
