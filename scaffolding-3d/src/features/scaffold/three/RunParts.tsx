'use client';

/**
 * 1列（Run）分の足場を描画する。
 * 精密な形状再現はせず、部材単位の寸法・本数が正しいことを優先する。
 * ジオメトリは単位形状を scale で使い回し、描画コストを抑える。
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { DECK_LAYOUT, DECK_VISUAL_WIDTH } from '../catalog/albatross';
import { nodePoints, type GlobalSettings, type Run } from '../model/types';

const M = 1 / 1000; // mm → m

// 視覚定数（m）
const LIFT = 1.8;
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
const C_TOE = '#d9a62e';
const C_TRANSOM = '#6b7b8c';
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
  rotationY = 0,
  color,
  paint,
}: {
  center: V3;
  size: V3;
  rotationY?: number;
  color: string;
  paint: Paint;
}) {
  return (
    <mesh geometry={unitBox} position={center} rotation={[0, rotationY, 0]} scale={size}>
      <meshStandardMaterial {...matProps(color, paint)} />
    </mesh>
  );
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
  const half = w / 2;
  const pts = useMemo(() => nodePoints(run).map((p) => ({ x: p.x * M, z: p.z * M })), [run]);
  const legTop = BASE_H + levels * LIFT + 0.95;

  if (run.bays.length === 0) return null;

  // 各節点における短手方向（進行方向に直交）を求める。
  // 角の節点は前後どちらかのベイの向きを使う（視覚上の簡略化）。
  const perpAt = (i: number): { x: number; z: number } => {
    const bay = run.bays[Math.min(i, run.bays.length - 1)];
    return { x: -bay.dir.z, z: bay.dir.x };
  };

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
      {/* ===== 節点ごと: 建地（内外2本）・ジャッキベース・短手布材・妻側部材 ===== */}
      {pts.map((p, i) => {
        const perp = perpAt(i);
        const inner: V3 = [p.x - perp.x * half, 0, p.z - perp.z * half];
        const outer: V3 = [p.x + perp.x * half, 0, p.z + perp.z * half];
        const isEnd = i === 0 || i === pts.length - 1;
        return (
          <group key={i}>
            {[inner, outer].map((leg, k) => (
              <group key={k}>
                {/* ジャッキベース */}
                <Box center={[leg[0], 0.02, leg[2]]} size={[0.13, 0.04, 0.13]} color={C_JACK} paint={paint} />
                <Bar a={[leg[0], 0.04, leg[2]]} b={[leg[0], BASE_H, leg[2]]} r={0.017} color={C_JACK} paint={paint} />
                {/* 支柱（組合せ本数は BOM 側で解決。視覚上は1本で表現） */}
                <Bar a={[leg[0], BASE_H, leg[2]]} b={[leg[0], legTop, leg[2]]} r={LEG_R} color={C_LEG} paint={paint} />
              </group>
            ))}
            {/* 短手布材（各段のアンチ受け） */}
            {Array.from({ length: levels }, (_, li) => {
              const y = BASE_H + (li + 1) * LIFT;
              return (
                <Bar
                  key={li}
                  a={[inner[0], y, inner[2]]}
                  b={[outer[0], y, outer[2]]}
                  r={TRANSOM_R}
                  color={C_TRANSOM}
                  paint={paint}
                />
              );
            })}
            {/* 妻側手すり・妻側巾木（列の両端のみ） */}
            {settings.tsuma &&
              isEnd &&
              Array.from({ length: levels }, (_, li) => {
                const deckY = BASE_H + (li + 1) * LIFT;
                return (
                  <group key={li}>
                    <Bar a={[inner[0], deckY + 0.45, inner[2]]} b={[outer[0], deckY + 0.45, outer[2]]} r={RAIL_R} color={C_RAIL} paint={paint} />
                    <Bar a={[inner[0], deckY + 0.9, inner[2]]} b={[outer[0], deckY + 0.9, outer[2]]} r={RAIL_R} color={C_RAIL} paint={paint} />
                    {settings.toeboard && (
                      <Box
                        center={[(inner[0] + outer[0]) / 2, deckY + TOE_H / 2 + DECK_T, (inner[2] + outer[2]) / 2]}
                        size={[Math.abs(outer[0] - inner[0]) || 0.015, TOE_H, Math.abs(outer[2] - inner[2]) || 0.015]}
                        color={C_TOE}
                        paint={paint}
                      />
                    )}
                  </group>
                );
              })}
          </group>
        );
      })}

      {/* ===== ベイ（スパン）ごと: アンチ・手すり・ブレス・巾木 ===== */}
      {run.bays.map((bay, bi) => {
        const a = pts[bi];
        const b = pts[bi + 1];
        const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
        const spanLen = bay.span * M;
        const alongX = bay.dir.z === 0; // スパンが X 軸方向か
        const perp = { x: -bay.dir.z, z: bay.dir.x };
        const bayPaint: Paint =
          selectedBayId === bay.id && paint.opacity === undefined ? { tint: HIGHLIGHT } : paint;
        const deckTypes = DECK_LAYOUT[run.width];
        const deckTotal = deckTypes.reduce((s, t) => s + DECK_VISUAL_WIDTH[t], 0) * M;

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
            {Array.from({ length: levels }, (_, li) => {
              const level = li + 1;
              const deckY = BASE_H + level * LIFT;
              const y0 = BASE_H + li * LIFT;
              return (
                <group key={li}>
                  {/* アンチ（枠幅ごとの敷き並べ構成） */}
                  {(() => {
                    let offset = -deckTotal / 2;
                    return deckTypes.map((t, di) => {
                      const dw = DECK_VISUAL_WIDTH[t] * M;
                      const c = offset + dw / 2;
                      offset += dw;
                      return (
                        <Box
                          key={di}
                          center={[mid.x + perp.x * c, deckY + DECK_T / 2, mid.z + perp.z * c]}
                          size={alongX ? [spanLen * 0.98, DECK_T, dw * 0.96] : [dw * 0.96, DECK_T, spanLen * 0.98]}
                          color={C_DECK}
                          paint={bayPaint}
                        />
                      );
                    });
                  })()}
                  {/* 長手手すり（内外 各1本） */}
                  {[-1, 1].map((side) => (
                    <Bar
                      key={side}
                      a={[a.x + perp.x * half * side, deckY + 0.9, a.z + perp.z * half * side]}
                      b={[b.x + perp.x * half * side, deckY + 0.9, b.z + perp.z * half * side]}
                      r={RAIL_R}
                      color={C_RAIL}
                      paint={bayPaint}
                    />
                  ))}
                  {/* ブレス（外側・段ごとに向き交互） */}
                  <Bar
                    a={[
                      (level % 2 === 1 ? a.x : b.x) + perp.x * half,
                      y0 + 0.1,
                      (level % 2 === 1 ? a.z : b.z) + perp.z * half,
                    ]}
                    b={[
                      (level % 2 === 1 ? b.x : a.x) + perp.x * half,
                      deckY - 0.1,
                      (level % 2 === 1 ? b.z : a.z) + perp.z * half,
                    ]}
                    r={BRACE_R}
                    color={C_BRACE}
                    paint={bayPaint}
                  />
                  {/* 巾木（内外 各1枚） */}
                  {settings.toeboard &&
                    [-1, 1].map((side) => (
                      <Box
                        key={side}
                        center={[
                          mid.x + perp.x * half * side * 0.97,
                          deckY + DECK_T + TOE_H / 2,
                          mid.z + perp.z * half * side * 0.97,
                        ]}
                        size={alongX ? [spanLen * 0.98, TOE_H, 0.015] : [0.015, TOE_H, spanLen * 0.98]}
                        color={C_TOE}
                        paint={bayPaint}
                      />
                    ))}
                </group>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}
