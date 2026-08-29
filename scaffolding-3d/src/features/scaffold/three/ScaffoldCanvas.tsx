'use client';

/**
 * 3Dキャンバス本体。
 * 組み立てモード: 地面をクリック → なぞる → クリックで確定 → ダブルクリック/Esc で列完成。
 * 選択モード: 部材クリックで選択（Ctrl=追加 / Shift=範囲）、右クリックで編集メニュー。
 * どちらのモードでも 右ドラッグ=回転 / ホイール=ズーム が使える。
 */
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { Grid, Html, OrbitControls } from '@react-three/drei';
import { useScaffoldStore } from '../store/useScaffoldStore';
import { spanBreakdownText } from '../model/fitting';
import { runLength } from '../model/types';
import { RunAssembly } from './RunParts';

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
        <RunAssembly
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
            <RunAssembly
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
              onContextMenu={(x, y, bayId) => {
                // 足場（スパン）の右クリック = その列を選択して編集メニュー（モード問わず）
                const st = useScaffoldStore.getState();
                if (st.mode !== 'select') st.setMode('select');
                if (st.selection?.runId !== run.id) {
                  if (bayId) st.selectBay(run.id, bayId);
                  else st.selectRun(run.id);
                } else if (bayId && !st.selection.bayIds.includes(bayId)) {
                  st.selectBay(run.id, bayId);
                }
                st.openContextMenu({ x, y, runId: run.id });
              }}
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
  const mode = useScaffoldStore((s) => s.mode);
  // 右クリック / 長押しの文脈での出し分け:
  //   ・足場（スパン）を右クリック/長押し → 編集メニュー（各メッシュの onContextMenu が開く）
  //   ・何もない空きスペースを右クリック/長押し → 入力⇔選択 モードを切り替え
  //   ・右ドラッグ（回転/パン）は切り替えない
  // contextmenu の発火タイミングは環境差があるため、判定後に一拍おいて
  // 「編集メニューが開いていなければ空きスペースだった」と判定して切り替える。
  const rightDown = useRef<{ x: number; y: number } | null>(null);
  // iPad等のタッチ: 長押し（500ms・移動なし）を右クリック相当として扱う
  const lpTimer = useRef<number | null>(null);
  const lpStart = useRef<{ x: number; y: number } | null>(null);
  const clearLongPress = () => {
    if (lpTimer.current !== null) {
      clearTimeout(lpTimer.current);
      lpTimer.current = null;
    }
    lpStart.current = null;
  };
  // 一拍おいて、編集メニューが開いていなければ（＝空きスペース）モードを切り替える。
  // R3F は contextmenu を1フレーム遅れて処理することがあるため、判定に余裕（100ms）を持たせる。
  const toggleModeIfEmpty = () => {
    setTimeout(() => {
      const s = useScaffoldStore.getState();
      if (s.contextMenu) return; // 足場 → 編集メニューが開いた。切替しない
      s.setMode(s.mode === 'build' ? 'select' : 'build');
    }, 100);
  };
  // タッチ長押し用: その座標に疑似 contextmenu を発火（足場ならR3FのonContextMenuで
  // 編集メニュー）→ 開かなければ空きスペースとしてモード切替。
  const fireContextAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y);
    if (el) {
      el.dispatchEvent(
        new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 2 }),
      );
    }
    toggleModeIfEmpty();
  };

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
    <div
      className="h-full w-full"
      style={{
        // 組み立て=クロスヘア／選択・編集=通常カーソル（PCのみ・タッチには影響なし）
        cursor: mode === 'build' ? 'crosshair' : 'default',
        touchAction: 'none',
        WebkitTouchCallout: 'none',
      }}
      onPointerDown={(e) => {
        if (e.button === 2) rightDown.current = { x: e.clientX, y: e.clientY };
        if (e.pointerType === 'touch') {
          clearLongPress();
          lpStart.current = { x: e.clientX, y: e.clientY };
          const x = e.clientX;
          const y = e.clientY;
          lpTimer.current = window.setTimeout(() => {
            clearLongPress();
            fireContextAt(x, y);
          }, 500);
        }
      }}
      onPointerMove={(e) => {
        // 長押し中に指が動いたら（回転/パン）長押しをキャンセル
        if (e.pointerType === 'touch' && lpStart.current && lpTimer.current !== null) {
          if (Math.hypot(e.clientX - lpStart.current.x, e.clientY - lpStart.current.y) > 10) clearLongPress();
        }
      }}
      onPointerUp={(e) => {
        if (e.pointerType === 'touch') clearLongPress(); // 指を離した=タップ（長押しでない）
        if (e.button !== 2) return;
        const start = rightDown.current;
        rightDown.current = null;
        // ドラッグ（回転/パン）は対象外。マウスは実 contextmenu が既に発火済みなので切替判定のみ
        if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) return;
        toggleModeIfEmpty();
      }}
      onPointerCancel={() => clearLongPress()}
      onContextMenu={(e) => e.preventDefault()}
    >
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
    </div>
  );
}
