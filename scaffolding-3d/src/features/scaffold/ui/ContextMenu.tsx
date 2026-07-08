'use client';

/**
 * 選択中の列を右クリックしたときの編集メニュー。
 * スパン変更・階段化は「選択中のスパン」（未選択なら列全体）に適用する。
 */
import { useEffect } from 'react';
import { SPANS, type SpanMM } from '../model/types';
import { useScaffoldStore } from '../store/useScaffoldStore';

export function ContextMenu() {
  const menu = useScaffoldStore((s) => s.contextMenu);
  const runs = useScaffoldStore((s) => s.runs);
  const selection = useScaffoldStore((s) => s.selection);

  useEffect(() => {
    if (!menu) return;
    const close = () => useScaffoldStore.getState().closeContextMenu();
    window.addEventListener('resize', close);
    return () => window.removeEventListener('resize', close);
  }, [menu]);

  if (!menu) return null;
  const run = runs.find((r) => r.id === menu.runId);
  if (!run) return null;

  // 対象スパン: 選択中のベイ（なければ列全体）
  const targetIds =
    selection?.runId === run.id && selection.bayIds.length > 0
      ? selection.bayIds
      : run.bays.map((b) => b.id);
  const targetLabel =
    selection?.runId === run.id && selection.bayIds.length > 0
      ? `選択中の${selection.bayIds.length}スパン`
      : `列全体（${run.bays.length}スパン）`;
  const allStair = run.bays.filter((b) => targetIds.includes(b.id)).every((b) => b.isStair);

  const st = () => useScaffoldStore.getState();

  return (
    <>
      {/* 背景クリックで閉じる */}
      <div className="fixed inset-0 z-40" onClick={() => st().closeContextMenu()} onContextMenu={(e) => { e.preventDefault(); st().closeContextMenu(); }} />
      <div
        className="fixed z-50 w-52 rounded-lg bg-white p-1.5 text-xs shadow-xl ring-1 ring-slate-200"
        style={{
          left: Math.min(menu.x, typeof window !== 'undefined' ? window.innerWidth - 220 : menu.x),
          top: Math.min(menu.y, typeof window !== 'undefined' ? window.innerHeight - 220 : menu.y),
        }}
      >
        <p className="px-2 py-1 font-bold text-slate-400">{targetLabel}</p>

        <div className="px-2 py-1">
          <p className="mb-1 text-slate-600">スパンを変更</p>
          <div className="flex flex-wrap gap-1">
            {SPANS.map((span) => (
              <button
                key={span}
                className="rounded-md bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-700 hover:bg-blue-100 hover:text-blue-700"
                onClick={() => {
                  st().setSpanForBays(run.id, targetIds, span as SpanMM);
                  st().closeContextMenu();
                }}
              >
                {span}
              </button>
            ))}
          </div>
        </div>

        <div className="my-1 border-t border-slate-100" />

        <button
          className="w-full rounded-md px-2 py-1.5 text-left font-semibold text-emerald-700 hover:bg-emerald-50"
          onClick={() => {
            st().setStairForBays(run.id, targetIds, !allStair);
            st().closeContextMenu();
          }}
        >
          🪜 {allStair ? '階段を解除する' : '階段に変更する'}
        </button>

        <div className="my-1 border-t border-slate-100" />

        <button
          className="w-full rounded-md px-2 py-1.5 text-left font-semibold text-red-600 hover:bg-red-50"
          onClick={() => {
            st().deleteRun(run.id);
          }}
        >
          🗑️ この列を削除
        </button>
      </div>
    </>
  );
}
