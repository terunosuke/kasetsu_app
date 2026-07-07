'use client';

import { SPANS, runLength, type SpanMM, type WidthMM, WIDTHS } from '../model/types';
import { useScaffoldStore } from '../store/useScaffoldStore';

const selectCls =
  'rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800';

export function SelectionPanel() {
  const selection = useScaffoldStore((s) => s.selection);
  const runs = useScaffoldStore((s) => s.runs);
  const run = runs.find((r) => r.id === selection?.runId);
  if (!selection || !run) return null;

  return (
    <div className="flex max-h-[32%] shrink-0 flex-col gap-2.5 overflow-y-auto rounded-xl bg-white/95 p-3 shadow-lg ring-1 ring-blue-200">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-blue-700">選択中の列</h2>
        <button
          className="text-xs text-slate-400 hover:text-slate-600"
          onClick={() => useScaffoldStore.getState().select(null)}
        >
          ✕ 解除
        </button>
      </div>

      <p className="text-xs text-slate-500">
        全長 {runLength(run).toLocaleString()}mm ／ {run.bays.length}スパン
      </p>

      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-slate-600">この列の枠幅</span>
        <select
          className={selectCls}
          value={run.width}
          onChange={(e) =>
            useScaffoldStore.getState().setRunWidth(run.id, Number(e.target.value) as WidthMM)
          }
        >
          {WIDTHS.map((w) => (
            <option key={w} value={w}>
              {w}mm
            </option>
          ))}
        </select>
      </div>

      {selection.bayId && (
        <button
          className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
          onClick={() => useScaffoldStore.getState().toggleBayStair(run.id, selection.bayId!)}
        >
          {run.bays.find((b) => b.id === selection.bayId)?.isStair
            ? '🪜 階段を解除する'
            : '🪜 このスパンを階段にする'}
        </button>
      )}

      <div className="max-h-44 overflow-y-auto rounded-md border border-slate-200">
        {run.bays.map((bay, i) => {
          const isSelected = selection.bayId === bay.id;
          return (
            <div
              key={bay.id}
              className={`flex items-center justify-between gap-2 border-b border-slate-100 px-2 py-1 last:border-b-0 ${
                isSelected ? 'bg-blue-50' : ''
              }`}
              onClick={() => useScaffoldStore.getState().select({ runId: run.id, bayId: bay.id })}
            >
              <span className="text-xs text-slate-500">
                #{i + 1}
                {bay.isStair && <span title="階段"> 🪜</span>}
              </span>
              <select
                className={selectCls}
                value={bay.span}
                onChange={(e) =>
                  useScaffoldStore
                    .getState()
                    .setBaySpan(run.id, bay.id, Number(e.target.value) as SpanMM)
                }
              >
                {SPANS.map((s) => (
                  <option key={s} value={s}>
                    {s}mm
                  </option>
                ))}
              </select>
              <button
                className="rounded px-1.5 py-0.5 text-xs text-red-500 hover:bg-red-50"
                title="このスパンを削除"
                onClick={(e) => {
                  e.stopPropagation();
                  useScaffoldStore.getState().deleteBay(run.id, bay.id);
                }}
              >
                削除
              </button>
            </div>
          );
        })}
      </div>

      <button
        className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-100"
        onClick={() => useScaffoldStore.getState().deleteRun(run.id)}
      >
        🗑️ この列を削除
      </button>
    </div>
  );
}
