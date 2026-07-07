'use client';

import type { ReactNode } from 'react';
import type { Bom } from '../logic/bom';
import { pillarComboText } from '../logic/bom';
import { pillarComboFor } from '../model/fitting';
import {
  WIDTHS,
  totalHeightMm,
  type GlobalSettings,
  type WallTieKind,
  type WidthMM,
} from '../model/types';
import { useScaffoldStore } from '../store/useScaffoldStore';

const PILLAR_LENGTHS = [3600, 2700, 1800, 1350, 900, 450, 225];

const rowCls = 'flex items-center justify-between gap-2';
const labelCls = 'text-xs text-slate-600';
const selectCls = 'rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-800';
const numCls =
  'w-14 rounded-md border border-slate-300 bg-white px-1.5 py-1 text-right text-xs text-slate-800';
const textCls =
  'w-24 rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-800';

function Section({
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

function Check({
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

function Num({
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

export function SettingsPanel({ bom }: { bom: Bom }) {
  const settings = useScaffoldStore((s) => s.settings);
  const update = useScaffoldStore((s) => s.updateSettings);
  const s = settings;
  const heightMm = totalHeightMm(s);
  const v = bom.validation;

  const setPillar = (len: number, count: number) => {
    const base = s.pillarOverride ?? pillarComboFor(heightMm);
    update({ pillarOverride: { ...base, [len]: Math.max(0, count) } });
  };

  return (
    <div className="flex flex-col gap-1.5 overflow-y-auto rounded-xl bg-white/95 p-2 shadow-lg ring-1 ring-slate-200">
      <h2 className="px-1 text-sm font-bold text-slate-800">設定（全体に反映）</h2>

      {/* ============ 基本 ============ */}
      <Section title="基本" defaultOpen>
        <div className={rowCls}>
          <span className={labelCls}>段数</span>
          <div className="flex items-center gap-1">
            <button
              className="h-6 w-6 rounded-md bg-slate-100 text-sm font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-40"
              disabled={s.levels <= 1}
              onClick={() => update({ levels: s.levels - 1 })}
            >
              −
            </button>
            <span className="w-10 text-center text-xs font-semibold text-slate-800">{s.levels}段</span>
            <button
              className="h-6 w-6 rounded-md bg-slate-100 text-sm font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-40"
              disabled={s.levels >= 12}
              onClick={() => update({ levels: s.levels + 1 })}
            >
              ＋
            </button>
          </div>
        </div>
        <Check label="最上段を900mmにする" checked={s.topLevelIs900} onChange={(v) => update({ topLevelIs900: v })} />
        <p className="-mt-1 text-right text-[10px] text-slate-400">
          総高さ {(heightMm / 1000).toFixed(2)}m
        </p>
        <div className={rowCls}>
          <span className={labelCls}>枠幅（新しい列）</span>
          <select
            className={selectCls}
            value={s.width}
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
          <span className={labelCls}>妻側（手すり・巾木）</span>
          <select
            className={selectCls}
            value={s.tsumaCount}
            onChange={(e) => update({ tsumaCount: Number(e.target.value) as 0 | 1 | 2 })}
          >
            <option value={0}>なし</option>
            <option value={1}>1面</option>
            <option value={2}>2面（両端）</option>
          </select>
        </div>
      </Section>

      {/* ============ 支柱・ジャッキ ============ */}
      <Section title="支柱・ジャッキ" badge={v.pillarStatus === 'mismatch' ? '⚠ 高さ不一致' : undefined}>
        <div className="rounded-md bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600">
          支柱構成（1建地あたり）: <span className="font-semibold">{bom.pillarText}</span>
        </div>
        <Check
          label="支柱構成を手動で調整"
          checked={s.pillarOverride !== null}
          onChange={(on) =>
            update({ pillarOverride: on ? pillarComboFor(heightMm) : null })
          }
        />
        {s.pillarOverride && (
          <>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              {PILLAR_LENGTHS.map((len) => (
                <div key={len} className={rowCls}>
                  <span className={labelCls}>{len}</span>
                  <input
                    type="number"
                    min={0}
                    className={numCls}
                    value={s.pillarOverride?.[len] ?? 0}
                    onChange={(e) => setPillar(len, Number(e.target.value) || 0)}
                  />
                </div>
              ))}
            </div>
            {v.pillarStatus === 'mismatch' ? (
              <p className="rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                ⚠ 構成の合計 {(v.pillarHeightMm / 1000).toFixed(2)}m が総高さ{' '}
                {(heightMm / 1000).toFixed(2)}m と一致しません
              </p>
            ) : (
              <p className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                ✓ 総高さと一致しています
              </p>
            )}
          </>
        )}

        <div className="my-0.5 border-t border-slate-100" />

        <div className={rowCls}>
          <span className={labelCls}>ジャッキベース</span>
          <select
            className={selectCls}
            value={s.jackBaseMode}
            onChange={(e) =>
              update({ jackBaseMode: e.target.value as GlobalSettings['jackBaseMode'] })
            }
          >
            <option value="none">なし</option>
            <option value="jackOnly">ジャッキのみ</option>
            <option value="jackWithTaiko">ジャッキ＋タイコ</option>
          </select>
        </div>
        {s.jackBaseMode !== 'none' && (
          <>
            <div className={rowCls}>
              <span className={labelCls}>種類</span>
              <select
                className={selectCls}
                value={s.jackBaseOption}
                onChange={(e) =>
                  update({ jackBaseOption: e.target.value as GlobalSettings['jackBaseOption'] })
                }
              >
                <option value="allSB20">すべてSB20</option>
                <option value="allSB40">すべてSB40</option>
                <option value="custom">混在（数を指定）</option>
              </select>
            </div>
            {s.jackBaseOption === 'custom' && (
              <>
                <Num label="SB20の数" value={s.sb20Count} onChange={(n) => update({ sb20Count: n })} />
                <Num label="SB40の数" value={s.sb40Count} onChange={(n) => update({ sb40Count: n })} />
                {v.jackBaseStatus !== 'ok' && (
                  <p className="rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                    ⚠ 必要数 {v.jackBaseNeeded} に対して {v.jackBaseProvided}（
                    {v.jackBaseStatus === 'under' ? '不足' : '過剰'}）
                  </p>
                )}
              </>
            )}
            {s.jackBaseMode === 'jackWithTaiko' && (
              <>
                <Num label="タイコ（40）" value={s.taiko40} onChange={(n) => update({ taiko40: n })} />
                <Num label="タイコ（80）" value={s.taiko80} onChange={(n) => update({ taiko80: n })} />
              </>
            )}
            <Check label="根がらみ支柱" checked={s.negarami} onChange={(v) => update({ negarami: v })} />
            <Check label="敷板" checked={s.basePlate} onChange={(v) => update({ basePlate: v })} />
          </>
        )}
      </Section>

      {/* ============ アンチ・巾木 ============ */}
      <Section title="アンチ・巾木">
        <div className={rowCls}>
          <span className={labelCls}>アンチ設置段</span>
          <select
            className={selectCls}
            value={s.antiMode}
            onChange={(e) => update({ antiMode: e.target.value as GlobalSettings['antiMode'] })}
          >
            <option value="all">全段</option>
            <option value="notBottom">最下段以外</option>
            <option value="custom">段を指定</option>
          </select>
        </div>
        {s.antiMode === 'custom' && (
          <div className={rowCls}>
            <span className={labelCls}>指定（例: 1,3,5）</span>
            <input
              className={textCls}
              value={s.antiLevels}
              onChange={(e) => update({ antiLevels: e.target.value })}
              placeholder="1,3,5"
            />
          </div>
        )}
        <div className={rowCls}>
          <span className={labelCls}>巾木の面</span>
          <select
            className={selectCls}
            value={s.toeboardFaces}
            onChange={(e) =>
              update({ toeboardFaces: e.target.value as GlobalSettings['toeboardFaces'] })
            }
          >
            <option value="both">両面</option>
            <option value="single">片面</option>
            <option value="none">なし</option>
          </select>
        </div>
        {s.toeboardFaces !== 'none' && (
          <>
            <div className={rowCls}>
              <span className={labelCls}>巾木の設置段</span>
              <select
                className={selectCls}
                value={s.toeboardMode}
                onChange={(e) =>
                  update({ toeboardMode: e.target.value as GlobalSettings['toeboardMode'] })
                }
              >
                <option value="sameAsAnti">アンチと同じ</option>
                <option value="all">全段</option>
                <option value="custom">段を指定</option>
              </select>
            </div>
            {s.toeboardMode === 'custom' && (
              <div className={rowCls}>
                <span className={labelCls}>指定（例: 1,3,5）</span>
                <input
                  className={textCls}
                  value={s.toeboardLevels}
                  onChange={(e) => update({ toeboardLevels: e.target.value })}
                  placeholder="1,3,5"
                />
              </div>
            )}
          </>
        )}
      </Section>

      {/* ============ 階段 ============ */}
      <Section title="階段" badge={bom.stairCount > 0 ? `${bom.stairCount}セット` : undefined}>
        <p className="rounded-md bg-blue-50 px-2 py-1.5 text-[11px] leading-relaxed text-blue-700">
          「選択・編集」モードでスパンをクリック →「階段にする」で配置します
        </p>
        <div className={rowCls}>
          <span className={labelCls}>階段の設置段</span>
          <select
            className={selectCls}
            value={s.stairMode}
            onChange={(e) => update({ stairMode: e.target.value as GlobalSettings['stairMode'] })}
          >
            <option value="notTop">最上段以外</option>
            <option value="custom">段を指定</option>
          </select>
        </div>
        {s.stairMode === 'custom' && (
          <div className={rowCls}>
            <span className={labelCls}>指定（例: 1,2）</span>
            <input
              className={textCls}
              value={s.stairLevels}
              onChange={(e) => update({ stairLevels: e.target.value })}
              placeholder="1,2"
            />
          </div>
        )}
        <Check
          label="階段部を拡幅する（914→1219差替等）"
          checked={s.stairWidening}
          onChange={(v) => update({ stairWidening: v })}
        />
      </Section>

      {/* ============ 壁つなぎ ============ */}
      <Section title="壁つなぎ" badge={s.wallTieMode !== 'none' ? 'あり' : undefined}>
        <div className={rowCls}>
          <span className={labelCls}>種類</span>
          <select
            className={selectCls}
            value={s.wallTieMode}
            onChange={(e) => update({ wallTieMode: e.target.value as WallTieKind })}
          >
            <option value="none">なし</option>
            <option value="KTS16">KTS16（160−200）</option>
            <option value="KTS20">KTS20（200−240）</option>
            <option value="KTS30">KTS30（240−320）</option>
            <option value="KTS45">KTS45（320−480）</option>
            <option value="KTS60">KTS60（480−670）</option>
            <option value="KTS80">KTS80（670−860）</option>
            <option value="KTS100">KTS100（860−1,050）</option>
          </select>
        </div>
        {s.wallTieMode !== 'none' && (
          <>
            <div className={rowCls}>
              <span className={labelCls}>設置段</span>
              <select
                className={selectCls}
                value={s.wallTieLevelMode}
                onChange={(e) =>
                  update({ wallTieLevelMode: e.target.value as GlobalSettings['wallTieLevelMode'] })
                }
              >
                <option value="all">全段</option>
                <option value="alternate">1段おき</option>
                <option value="custom">段数を指定</option>
              </select>
            </div>
            {s.wallTieLevelMode === 'custom' && (
              <Num label="設置段数" value={s.wallTieLevelCount} onChange={(n) => update({ wallTieLevelCount: n })} />
            )}
            <div className={rowCls}>
              <span className={labelCls}>設置スパン</span>
              <select
                className={selectCls}
                value={s.wallTieSpanMode}
                onChange={(e) =>
                  update({ wallTieSpanMode: e.target.value as GlobalSettings['wallTieSpanMode'] })
                }
              >
                <option value="all">全スパン</option>
                <option value="alternate">1スパンおき</option>
                <option value="custom">数を指定</option>
              </select>
            </div>
            {s.wallTieSpanMode === 'custom' && (
              <Num label="1段あたり設置数" value={s.wallTieSpanCount} onChange={(n) => update({ wallTieSpanCount: n })} />
            )}
          </>
        )}
      </Section>

      {/* ============ 養生・シート ============ */}
      <Section
        title="養生・シート"
        badge={s.layerNet || s.sheet ? 'あり' : undefined}
      >
        <Check label="層間養生ネット" checked={s.layerNet} onChange={(v) => update({ layerNet: v })} />
        {s.layerNet && (
          <>
            <div className={rowCls}>
              <span className={labelCls}>設置段</span>
              <select
                className={selectCls}
                value={s.layerNetLevelMode}
                onChange={(e) =>
                  update({ layerNetLevelMode: e.target.value as GlobalSettings['layerNetLevelMode'] })
                }
              >
                <option value="all">全段</option>
                <option value="alternate">1段おき</option>
                <option value="custom">段数を指定</option>
              </select>
            </div>
            {s.layerNetLevelMode === 'custom' && (
              <Num label="設置段数" value={s.layerNetLevelCount} onChange={(n) => update({ layerNetLevelCount: n })} />
            )}
          </>
        )}
        <div className="my-0.5 border-t border-slate-100" />
        <Check label="外周メッシュシート" checked={s.sheet} onChange={(v) => update({ sheet: v })} />
        {s.sheet && (
          <>
            <div className={rowCls}>
              <span className={labelCls}>設置段</span>
              <select
                className={selectCls}
                value={s.sheetLevelMode}
                onChange={(e) =>
                  update({ sheetLevelMode: e.target.value as GlobalSettings['sheetLevelMode'] })
                }
              >
                <option value="all">全段</option>
                <option value="custom">段数を指定</option>
              </select>
            </div>
            {s.sheetLevelMode === 'custom' && (
              <Num label="設置段数" value={s.sheetLevelCount} onChange={(n) => update({ sheetLevelCount: n })} />
            )}
            <div className={rowCls}>
              <span className={labelCls}>妻側シート</span>
              <select
                className={selectCls}
                value={s.tsumaSheetCount}
                onChange={(e) =>
                  update({ tsumaSheetCount: Number(e.target.value) as 0 | 1 | 2 })
                }
              >
                <option value={0}>なし</option>
                <option value={1}>1面</option>
                <option value={2}>2面</option>
              </select>
            </div>
          </>
        )}
      </Section>

      {/* ============ メモ ============ */}
      <Section title="フリーメモ" badge={s.memo ? 'あり' : undefined}>
        <textarea
          className="h-16 w-full resize-none rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
          placeholder="CSVの末尾に出力されます"
          value={s.memo}
          onChange={(e) => update({ memo: e.target.value })}
        />
      </Section>
    </div>
  );
}
