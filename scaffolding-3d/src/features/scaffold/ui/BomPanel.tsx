'use client';

import { useState } from 'react';
import type { Bom } from '../logic/bom';
import { downloadCsv, downloadExcel } from '../logic/exportFile';
import { useScaffoldStore } from '../store/useScaffoldStore';

export function BomPanel({ bom }: { bom: Bom }) {
  const memo = useScaffoldStore((s) => s.settings.memo);
  const [showSplit, setShowSplit] = useState(false);
  const v = bom.validation;
  const hasWarning = v.pillarStatus === 'mismatch' || v.jackBaseStatus !== 'ok';

  return (
    <div className="flex min-h-32 flex-1 flex-col gap-2 rounded-xl bg-white/95 p-3 shadow-lg ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-800">📊 数量拾い出し</h2>
        <div className="flex gap-1">
          <button
            className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
            disabled={bom.rows.length === 0}
            onClick={() => downloadCsv(bom, memo)}
          >
            ⬇ CSV
          </button>
          <button
            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
            disabled={bom.rows.length === 0}
            onClick={() => downloadExcel(bom)}
            title="規格コード・数量の発注書式（xlsx）"
          >
            ⬇ Excel
          </button>
        </div>
      </div>

      {hasWarning && (
        <div className="rounded-md bg-amber-50 px-2 py-1.5 text-[11px] font-semibold text-amber-700">
          {v.pillarStatus === 'mismatch' && <div>⚠ 支柱構成が総高さと一致していません</div>}
          {v.jackBaseStatus !== 'ok' && (
            <div>
              ⚠ ジャッキベースが{v.jackBaseStatus === 'under' ? '不足' : '過剰'}（必要
              {v.jackBaseNeeded}／指定{v.jackBaseProvided}）
            </div>
          )}
        </div>
      )}

      {bom.rows.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-400">
          足場を配置すると自動で集計されます
        </p>
      ) : (
        <>
          {/* サマリー */}
          <div className="grid grid-cols-2 gap-1 rounded-md bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600">
            <span>総高さ</span>
            <span className="text-right font-semibold">{(bom.totalHeightMm / 1000).toFixed(2)} m</span>
            <span>スパン計</span>
            <span className="text-right font-semibold">
              {bom.bayCount}スパン／{(bom.totalLengthMm / 1000).toFixed(2)} m
            </span>
            <span>支柱構成/建地</span>
            <span className="text-right font-semibold">{bom.pillarText}</span>
            {bom.stairCount > 0 && (
              <>
                <span>階段</span>
                <span className="text-right font-semibold">{bom.stairCount}セット</span>
              </>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-slate-200">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="text-slate-500">
                  <th className="px-2 py-1 text-left font-semibold">部材</th>
                  <th className="px-1 py-1 text-left font-semibold">規格</th>
                  <th className="px-1 py-1 text-right font-semibold">数量</th>
                  <th className="px-2 py-1 text-right font-semibold">重量kg</th>
                </tr>
              </thead>
              <tbody>
                {bom.rows.map((row) => (
                  <tr key={row.name} className="border-t border-slate-100 text-slate-700">
                    <td className="px-2 py-1">{row.name}</td>
                    <td className="px-1 py-1 text-slate-400">{row.spec}</td>
                    <td className="px-1 py-1 text-right font-semibold">{row.quantity}</td>
                    <td className="px-2 py-1 text-right">{row.totalWeightKg.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
            <div className="flex justify-between font-bold text-slate-800">
              <span>総重量</span>
              <span>{bom.totalWeightKg.toLocaleString()} kg</span>
            </div>
            <div className="mt-0.5 flex justify-between">
              <span>ユニック</span>
              <span>{bom.transportUnic}</span>
            </div>
            <div className="flex justify-between">
              <span>平車</span>
              <span>{bom.transportFlatbed}</span>
            </div>
            <label className="mt-1 flex cursor-pointer items-center gap-1.5 border-t border-slate-200 pt-1">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-blue-600"
                checked={showSplit}
                onChange={(e) => setShowSplit(e.target.checked)}
              />
              <span className="font-semibold">車両を分割する</span>
            </label>
            {showSplit &&
              (bom.splitOptions.length > 0 ? (
                <select className="mt-1 w-full rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs">
                  {bom.splitOptions.map((opt) => (
                    <option key={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <p className="mt-1 text-[11px] text-slate-400">
                  総重量が小さく、分割の推奨はありません
                </p>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
