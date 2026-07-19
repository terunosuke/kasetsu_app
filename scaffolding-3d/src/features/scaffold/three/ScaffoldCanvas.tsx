'use client';

/**
 * 3Dキャンバス本体。
 * 組み立てモード: 地面をクリック → なぞる → クリックで確定 → ダブルクリック/Esc で列完成。
 * 選択モード: 部材クリックで選択（Ctrl=追加 / Shift=範囲）、右クリックで編集メニュー。
 * どちらのモードでも 右ドラッグ=回転 / ホイール=ズーム が使える。
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { Grid, Html, OrbitControls } from '@react-three/drei';
import { useScaffoldStore } from '../store/useScaffoldStore';
import { spanBreakdownText } from '../model/fitting';
import { runLength } from '../model/types';
import { RunParts } from './RunParts';

const M = 1 / 1000;

/** 地面クリック・ポインタ移動の受け皿 */
function GroundPlane() {
  return (
    <mesh
      rotation-x={-Math.PI / 2}
      position={[0, -0.002, 0]}
      onPointerMove={(e: ThreeEvent<PointerEvent>) => {
        useScaffoldStore.getState().pointerMove({ x: e.point.x * 1000, z: e.point.z * 1000 });
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (e.delta > 5) return; // ドラッグ（視点操作）後のクリックは無視
        const s = useScaffoldStore.getState();
        if (s.contextMenu) {
          s.closeContextMenu();
          return;
        }
        if (s.mode === 'build') {
          s.pointerClick({ x: e.point.x * 1000, z: e.point.z * 1000 });
        } else {
          s.clearSelection();
        }
      }}
      onDoubleClick={() => {
        useScaffoldStore.getState().finishDraft();
      }}
    >
      <planeGeometry args={[600, 600]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

/** 描画中のゴースト（確定済み区間＋カーソル追従区間）と寸法ラベル */
function GhostRun() {
  const draft = useScaffoldStore((s) => s.draft);
  const settings = useScaffoldStore((s) => s.settings);
  if (!draft) return null;

  const allBays = [...draft.bays, ...draft.preview];
  const totalMm = allBays.reduce((sum, b) => sum + b.span, 0);

  return (
    <group>
      {/* 始点マーカー */}
      <mesh position={[draft.origin.x * M, 0.06, draft.origin.z * M]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#2563eb" />
      </mesh>
      {allBays.length > 0 && (
        <RunParts
          run={{ origin: draft.origin, bays: allBays, width: settings.width }}
          settings={settings}
          paint={{ opacity: 0.4, tint: '#3b82f6' }}
        />
      )}
      <Html position={[draft.cursorEnd.x * M, 0.35, draft.cursorEnd.z * M]} center style={{ pointerEvents: 'none' }}>
        <div className="whitespace-nowrap rounded-md bg-blue-600/90 px-2 py-1 text-xs font-semibold text-white shadow">
          {totalMm > 0 ? (
            <>
              {totalMm.toLocaleString()}mm（{spanBreakdownText(allBays.map((b) => b.span))}）
            </>
          ) : (
            'なぞって伸ばす'
          )}
        </div>
      </Html>
    </group>
  );
}

/** 配置済みの全列 */
function PlacedRuns() {
  const runs = useScaffoldStore((s) => s.runs);
  const settings = useScaffoldStore((s) => s.settings);
  const selection = useScaffoldStore((s) => s.selection);
  const mode = useScaffoldStore((s) => s.mode);

  return (
    <>
      {runs.map((run) => {
        const isSelected = selection?.runId === run.id;
        const selectedBayIds = isSelected ? new Set(selection.bayIds) : null;
        return (
          <group key={run.id}>
            <RunParts
              run={run}
              settings={settings}
              selectedBayIds={selectedBayIds}
              onPickBay={
                mode === 'select'
                  ? (bayId, mods) => useScaffoldStore.getState().selectBay(run.id, bayId, mods)
                  : undefined
              }
              onPickBays={
                mode === 'select'
                  ? (bayIds) => useScaffoldStore.getState().selectBays(run.id, bayIds)
                  : undefined
              }
              onPickRun={
                mode === 'select' ? () => useScaffoldStore.getState().selectRun(run.id) : undefined
              }
              onContextMenu={
                mode === 'select'
                  ? (x, y, bayId) => {
                      const st = useScaffoldStore.getState();
                      // 未選択の列を右クリックしたら、その列（＋ベイ）を選択してからメニュー
                      if (st.selection?.runId !== run.id) {
                        if (bayId) st.selectBay(run.id, bayId);
                        else st.selectRun(run.id);
                      } else if (bayId && !st.selection.bayIds.includes(bayId)) {
                        st.selectBay(run.id, bayId);
                      }
                      st.openContextMenu({ x, y, runId: run.id });
                    }
                  : undefined
              }
            />
            {/* 選択中の列の全長ラベル */}
            {isSelected && (
              <Html
                position={[run.origin.x * M, settings.levels * 1.8 + 1.6, run.origin.z * M]}
                center
                style={{ pointerEvents: 'none' }}
              >
                <div className="whitespace-nowrap rounded-md bg-slate-800/90 px-2 py-1 text-xs font-semibold text-white shadow">
                  全長 {runLength(run).toLocaleString()}mm ／ 枠幅 {run.width}
                  {selection.bayIds.length > 0 && ` ／ ${selection.bayIds.length}スパン選択`}
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </>
  );
}

function Controls() {
  const mode = useScaffoldStore((s) => s.mode);
  const mouseButtons = useMemo(
    () =>
      mode === 'build'
        ? { LEFT: undefined as unknown as THREE.MOUSE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
        : { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN },
    [mode],
  );
  return (
    <OrbitControls
      makeDefault
      mouseButtons={mouseButtons}
      maxPolarAngle={Math.PI / 2 - 0.04}
      minDistance={2}
      maxDistance={150}
    />
  );
}

export default function ScaffoldCanvas() {
  // Esc / Enter: メニューを閉じる → 描画中の列を完成
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        const s = useScaffoldStore.getState();
        if (s.contextMenu) {
          s.closeContextMenu();
          return;
        }
        s.finishDraft();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Canvas camera={{ position: [16, 13, 16], fov: 45 }} className="h-full w-full">
      <color attach="background" args={['#eef3f8']} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[12, 24, 8]} intensity={1.1} />
      <directionalLight position={[-10, 12, -14]} intensity={0.3} />
      <Grid
        position={[0, 0, 0]}
        args={[300, 300]}
        cellSize={0.9145}
        cellColor="#c3cdd8"
        sectionSize={4.5725}
        sectionColor="#8fa3b8"
        fadeDistance={90}
        fadeStrength={1.2}
      />
      <GroundPlane />
      <PlacedRuns />
      <GhostRun />
      <Controls />
    </Canvas>
  );
}
