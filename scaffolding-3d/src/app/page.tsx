'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { computeBom } from '@/features/scaffold/logic/bom';
import { useScaffoldStore } from '@/features/scaffold/store/useScaffoldStore';
import { BomPanel } from '@/features/scaffold/ui/BomPanel';
import { SelectionPanel } from '@/features/scaffold/ui/SelectionPanel';
import { SettingsPanel } from '@/features/scaffold/ui/SettingsPanel';
import { Toolbar } from '@/features/scaffold/ui/Toolbar';

const ScaffoldCanvas = dynamic(() => import('@/features/scaffold/three/ScaffoldCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-slate-400">
      3Dビューを読み込み中…
    </div>
  ),
});

function HintBar() {
  const mode = useScaffoldStore((s) => s.mode);
  const draft = useScaffoldStore((s) => s.draft);
  const hasRuns = useScaffoldStore((s) => s.runs.length > 0);

  let text: string;
  if (mode === 'build') {
    if (!draft) {
      text = hasRuns
        ? '地面をクリックすると次の列を開始します（右ドラッグ=回転 / ホイール=ズーム）'
        : '① 地面をクリックして始点を置く → ② なぞって伸ばす → ③ クリックで確定（続けて角も作れます）';
    } else {
      text = 'クリックで区間を確定して続行 ／ ダブルクリック・Esc・Enter で列を完成';
    }
  } else {
    text = '足場をクリックして選択（左ドラッグ=回転 / 右ドラッグ=移動 / ホイール=ズーム）';
  }

  return (
    <div className="pointer-events-none rounded-full bg-slate-800/85 px-4 py-1.5 text-xs font-medium text-white shadow-lg">
      {text}
    </div>
  );
}

export default function Home() {
  const runs = useScaffoldStore((s) => s.runs);
  const settings = useScaffoldStore((s) => s.settings);
  const bom = useMemo(() => computeBom(runs, settings), [runs, settings]);

  return (
    <div className="relative h-full w-full bg-slate-100">
      {/* 3D ビュー（全画面） */}
      <div className="absolute inset-0">
        <ScaffoldCanvas />
      </div>

      {/* ヘッダー */}
      <header className="pointer-events-none absolute left-4 top-4 z-10">
        <div className="pointer-events-auto rounded-xl bg-white/95 px-4 py-2 shadow-lg ring-1 ring-slate-200">
          <h1 className="text-base font-bold text-slate-800">
            🏗️ アルバトロス 3D組立シミュレーター
          </h1>
          <p className="text-xs text-slate-500">次世代足場 配置シミュレーション＆数量拾い</p>
        </div>
      </header>

      {/* 左: ツールバー */}
      <div className="absolute left-4 top-24 z-10">
        <Toolbar />
      </div>

      {/* 右: 設定・選択・数量 */}
      <div className="absolute bottom-4 right-4 top-4 z-10 flex w-80 flex-col gap-3">
        <SettingsPanel />
        <SelectionPanel />
        <BomPanel bom={bom} />
      </div>

      {/* 下: 操作ヒント */}
      <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
        <HintBar />
      </div>
    </div>
  );
}
