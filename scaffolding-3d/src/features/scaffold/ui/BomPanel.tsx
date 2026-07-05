'use client';

import type { Bom } from '../logic/bom';
import { downloadCsv } from '../logic/csv';

export function BomPanel({ bom }: { bom: Bom }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 rounded-xl bg-white/95 p-3 shadow-lg ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-800">📊 数量拾い出し</h2>
        <button
          className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
          disabled={bom.rows.length === 0}
          onClick={() => downloadCsv(bom)}
        >
          ⬇ CSV出力
        </button>
      </div>

      {bom.rows.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-400">
          足場を配置すると自動で集計されます
        </p>
      ) : (
        <>
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
          </div>
        </>
      )}
    </div>
  );
}
