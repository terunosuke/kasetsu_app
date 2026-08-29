'use client';

/**
 * 設定・編集パネル共通の小さな表示部品とスタイル定数。
 * 表示のみ（ロジックなし）。SettingsPanel から分離して再利用可能にしたもの。
 */
import type { ReactNode } from 'react';

export const rowCls = 'flex items-center justify-between gap-2';
export const labelCls = 'text-xs text-slate-600';
export const selectCls =
  'rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-800';
export const numCls =
  'w-14 rounded-md border border-slate-300 bg-white px-1.5 py-1 text-right text-xs text-slate-800';
export const textCls =
  'w-24 rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-800';

export function Section({
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group rounded-lg border border-slate-200 bg-white">
      <summary className="flex cursor-pointer select-none items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
        <span>{title}</span>
        <span className="flex items-center gap-1.5">
          {badge && (
            <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">
              {badge}
            </span>
          )}
          <span className="text-slate-400 transition-transform group-open:rotate-90">▸</span>
        </span>
      </summary>
      <div className="flex flex-col gap-2 border-t border-slate-100 px-2.5 py-2">{children}</div>
    </details>
  );
}

export function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2">
      <span className={labelCls}>{label}</span>
      <input
        type="checkbox"
        className="h-4 w-4 accent-blue-600"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export function Num({
  label,
  value,
  onChange,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  return (
    <div className={rowCls}>
      <span className={labelCls}>{label}</span>
      <input
        type="number"
        min={min}
        className={numCls}
        value={value}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
      />
    </div>
  );
}
