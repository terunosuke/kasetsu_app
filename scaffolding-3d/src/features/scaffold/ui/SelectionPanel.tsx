'use client';

import { SPANS, openingGroups, runLength, type SpanMM, type WidthMM, WIDTHS } from '../model/types';
import { useScaffoldStore } from '../store/useScaffoldStore';

const selectCls =
  'rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800';

export function SelectionPanel() {
  const selection = useScaffoldStore((s) => s.selection);
  const runs = useScaffoldStore((s) => s.runs);
  const run = runs.find((r) => r.id === selection?.runId);
  if (!selection || !run) return null;

  const selectedIds = selection.bayIds;
  const st = () => useScaffoldStore.getState();

  return (
    <div className="flex max-h-[32%] shrink-0 flex-col gap-2.5 overflow-y-auto rounded-xl bg-white/95 p-3 shadow-lg ring-1 ring-blue-200">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-blue-700">
          選択中の列{selectedIds.length > 0 && `（${selectedIds.length}スパン選択）`}
        </h2>
        <button
          className="text-xs text-slate-400 hover:text-slate-600"
          onClick={() => st().clearSelection()}
        >
          ✕ 解除
        </button>
      </div>

      <p className="text-xs text-slate-500">
        全長 {runLength(run).toLocaleString()}mm ／ {run.bays.length}スパン
      </p>
      <p className="-mt-1.5 text-[10px] leading-relaxed text-slate-400">
        Ctrl+クリック=追加選択 ／ Shift+クリック=範囲選択 ／ 右クリック=編集メニュー
      </p>

      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-slate-600">この列の枠幅</span>
        <select
          className={selectCls}
          value={run.width}
          onChange={(e) => st().setRunWidth(run.id, Number(e.target.value) as WidthMM)}
        >
          {WIDTHS.map((w) => (
            <option key={w} value={w}>
              {w}mm
            </option>
          ))}
        </select>
      </div>

      {selectedIds.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-slate-600">選択スパンのサイズ</span>
            <select
              className={selectCls}
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  st().setSpanForBays(run.id, selectedIds, Number(e.target.value) as SpanMM);
                }
              }}
            >
              <option value="">変更...</option>
              {SPANS.map((s) => (
                <option key={s} value={s}>
                  {s}mm
                </option>
              ))}
            </select>
          </div>
          <button
            className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
            onClick={() => {
              const allStair = run.bays
                .filter((b) => selectedIds.includes(b.id))
                .every((b) => b.isStair);
              st().setStairForBays(run.id, selectedIds, !allStair);
            }}
          >
            🪜{' '}
            {run.bays.filter((b) => selectedIds.includes(b.id)).every((b) => b.isStair)
              ? '階段を解除する'
              : selectedIds.length === 1
                ? 'ここに階段を配置する（2スパン使用）'
                : '選択スパンを階段にする'}
          </button>
          <p className="-mt-1 text-[10px] leading-relaxed text-slate-400">
            階段は2スパン1セットで斜めに登ります（1スパン選択時は隣と自動ペア）
          </p>
          {(() => {
            const selBays = run.bays.filter((b) => selectedIds.includes(b.id));
            const allOpening = selBays.length > 0 && selBays.every((b) => b.openingLevels);
            // 選択ベイが属する開口グループ全体に高さ変更を適用する
            const groupsForSel = openingGroups(run.bays).filter((g) =>
              g.bayIndices.some((bi) => selectedIds.includes(run.bays[bi].id)),
            );
            const groupBayIds = groupsForSel.flatMap((g) => g.bayIndices.map((bi) => run.bays[bi].id));
            return (
              <>
                <button
                  className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                  onClick={() =>
                    st().setOpeningForBays(run.id, allOpening ? groupBayIds : selectedIds, allOpening ? null : 2)
                  }
                >
                  🚪 {allOpening ? '開口部を解除する' : '開口部にする（梁枠）'}
                </button>
                {allOpening && groupsForSel.length > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-slate-600">開口の高さ</span>
                    <select
                      className={selectCls}
                      value={groupsForSel[0].levels}
                      onChange={(e) =>
                        st().setOpeningForBays(run.id, groupBayIds, Number(e.target.value))
                      }
                    >
                      <option value={1}>1層（1800）</option>
                      <option value={2}>2層（3600）</option>
                      <option value={3}>3層（5400）</option>
                    </select>
                  </div>
                )}
                {allOpening && (
                  <p className="-mt-1 text-[10px] leading-relaxed text-amber-600">
                    梁枠は開口幅（1.5〜4スパン相当）で自動選定・両構面2枚。開口上部の積載は800kg以下、
                    両端支柱付近に壁つなぎ、外方1スパンに布材・先行手すりを設けてください
                  </p>
                )}
              </>
            );
          })()}
        </>
      )}

      <div className="max-h-44 overflow-y-auto rounded-md border border-slate-200">
        {run.bays.map((bay, i) => {
          const isSelected = selectedIds.includes(bay.id);
          return (
            <div
              key={bay.id}
              className={`flex items-center justify-between gap-2 border-b border-slate-100 px-2 py-1 last:border-b-0 ${
                isSelected ? 'bg-blue-50' : ''
              }`}
              onClick={(e) =>
                st().selectBay(run.id, bay.id, {
                  shift: e.shiftKey,
                  ctrl: e.ctrlKey || e.metaKey,
                })
              }
            >
              <span className="text-xs text-slate-500">
                #{i + 1}
                {bay.isStair && <span title="階段"> 🪜</span>}
                {bay.openingLevels && <span title={`開口部 ${bay.openingLevels}層`}> 🚪</span>}
              </span>
              <select
                className={selectCls}
                value={bay.span}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => st().setBaySpan(run.id, bay.id, Number(e.target.value) as SpanMM)}
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
                  st().deleteBay(run.id, bay.id);
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
        onClick={() => st().deleteRun(run.id)}
      >
        🗑️ この列を削除
      </button>
    </div>
  );
}
