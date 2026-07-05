'use client';

import { useScaffoldStore } from '../store/useScaffoldStore';

const btnBase =
  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors';

export function Toolbar() {
  const mode = useScaffoldStore((s) => s.mode);
  const draft = useScaffoldStore((s) => s.draft);
  const canUndo = useScaffoldStore((s) => s.history.length > 0);
  const hasRuns = useScaffoldStore((s) => s.runs.length > 0);

  return (
    <div className="flex w-44 flex-col gap-1.5 rounded-xl bg-white/95 p-2 shadow-lg ring-1 ring-slate-200">
      <button
        className={`${btnBase} ${mode === 'build' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
        onClick={() => useScaffoldStore.getState().setMode('build')}
      >
        ✏️ 組み立て
      </button>
      <button
        className={`${btnBase} ${mode === 'select' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
        onClick={() => useScaffoldStore.getState().setMode('select')}
      >
        👆 選択・編集
      </button>

      {draft && (
        <button
          className={`${btnBase} bg-emerald-600 text-white hover:bg-emerald-700`}
          onClick={() => useScaffoldStore.getState().finishDraft()}
        >
          ✅ この列を確定
        </button>
      )}

      <div className="my-0.5 border-t border-slate-200" />

      <button
        className={`${btnBase} bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-40`}
        disabled={!canUndo}
        onClick={() => useScaffoldStore.getState().undo()}
      >
        ↩️ 元に戻す
      </button>
      <button
        className={`${btnBase} bg-slate-100 text-red-600 hover:bg-red-50 disabled:opacity-40`}
        disabled={!hasRuns && !draft}
        onClick={() => {
          if (window.confirm('配置した足場をすべて削除しますか？')) {
            useScaffoldStore.getState().clearAll();
          }
        }}
      >
        🗑️ 全て削除
      </button>
    </div>
  );
}
