'use client';

import { WIDTHS, type WidthMM } from '../model/types';
import { useScaffoldStore } from '../store/useScaffoldStore';

const rowCls = 'flex items-center justify-between gap-2';
const labelCls = 'text-sm text-slate-600';
const selectCls =
  'rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800';

export function SettingsPanel() {
  const settings = useScaffoldStore((s) => s.settings);
  const update = useScaffoldStore((s) => s.updateSettings);

  return (
    <div className="flex flex-col gap-2.5 rounded-xl bg-white/95 p-3 shadow-lg ring-1 ring-slate-200">
      <h2 className="text-sm font-bold text-slate-800">基本設定（全体に反映）</h2>

      <div className={rowCls}>
        <span className={labelCls}>段数</span>
        <div className="flex items-center gap-1">
          <button
            className="h-7 w-7 rounded-md bg-slate-100 font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-40"
            disabled={settings.levels <= 1}
            onClick={() => update({ levels: settings.levels - 1 })}
          >
            −
          </button>
          <span className="w-14 text-center text-sm font-semibold text-slate-800">
            {settings.levels}段
          </span>
          <button
            className="h-7 w-7 rounded-md bg-slate-100 font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-40"
            disabled={settings.levels >= 12}
            onClick={() => update({ levels: settings.levels + 1 })}
          >
            ＋
          </button>
        </div>
      </div>
      <p className="-mt-1.5 text-right text-xs text-slate-400">
        高さ {(settings.levels * 1.8).toFixed(1)}m（1段=1800mm）
      </p>

      <div className={rowCls}>
        <span className={labelCls}>枠幅（新しい列）</span>
        <select
          className={selectCls}
          value={settings.width}
          onChange={(e) => update({ width: Number(e.target.value) as WidthMM })}
        >
          {WIDTHS.map((w) => (
            <option key={w} value={w}>
              {w}mm
            </option>
          ))}
        </select>
      </div>

      <div className={rowCls}>
        <span className={labelCls}>ジャッキベース</span>
        <select
          className={selectCls}
          value={settings.jackBase}
          onChange={(e) => update({ jackBase: e.target.value as 'SB20' | 'SB40' })}
        >
          <option value="SB20">SB20</option>
          <option value="SB40">SB40</option>
        </select>
      </div>

      {(
        [
          ['toeboard', '巾木（両面）'],
          ['tsuma', '妻側手すり・巾木'],
          ['negarami', '根がらみ支柱'],
          ['basePlate', '敷板'],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="flex cursor-pointer items-center justify-between gap-2">
          <span className={labelCls}>{label}</span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-blue-600"
            checked={settings[key]}
            onChange={(e) => update({ [key]: e.target.checked })}
          />
        </label>
      ))}
    </div>
  );
}
