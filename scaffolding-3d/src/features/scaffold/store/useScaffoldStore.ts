/**
 * アプリの状態管理。
 * 保存するのは配置パラメータ（runs）と全体設定・UI状態のみ。
 * 部材数量・3D形状はコンポーネント側でここから導出する。
 *
 * 操作フロー（組み立てモード）:
 *   クリック → 始点を置く
 *   マウス移動 → スパン割りされたプレビューが追従
 *   クリック → その区間を確定し、続けて次の区間へ（角も作れる）
 *   ダブルクリック / Esc / Enter → 列として完成
 *
 * 選択（選択・編集モード）:
 *   クリック = 単一選択 ／ Ctrl+クリック = 追加・解除 ／ Shift+クリック = 範囲選択
 *   右クリック = コンテキストメニュー（スパン変更・階段化など）
 */
import { create } from 'zustand';
import { fitSpans, segmentFrom, snapPoint } from '../model/fitting';
import {
  DEFAULT_SETTINGS,
  nodePoints,
  type Bay,
  type GlobalSettings,
  type Run,
  type SpanMM,
  type Vec2,
  type WidthMM,
} from '../model/types';

export type Mode = 'build' | 'select';

export interface Draft {
  origin: Vec2;
  bays: Bay[]; // クリックで確定済みの区間
  preview: Bay[]; // カーソル追従中の区間
  cursorEnd: Vec2; // プレビュー終端（寸法ラベル表示位置）
}

/** 選択状態。bayIds が空 = 列のみ選択 */
export interface Selection {
  runId: string;
  bayIds: string[];
}

export interface SelectModifiers {
  shift?: boolean;
  ctrl?: boolean;
}

/** 右クリックメニュー（画面座標） */
export interface ContextMenu {
  x: number;
  y: number;
  runId: string;
}

interface ScaffoldState {
  runs: Run[];
  settings: GlobalSettings;
  mode: Mode;
  draft: Draft | null;
  selection: Selection | null;
  contextMenu: ContextMenu | null;
  history: Run[][];

  setMode(mode: Mode): void;
  updateSettings(patch: Partial<GlobalSettings>): void;

  pointerMove(point: Vec2): void;
  pointerClick(point: Vec2): void;
  finishDraft(): void;
  cancelDraft(): void;

  selectBay(runId: string, bayId: string, mods?: SelectModifiers): void;
  /** 複数ベイをまとめて選択（開口部クリックなどで使用） */
  selectBays(runId: string, bayIds: string[]): void;
  selectRun(runId: string): void;
  clearSelection(): void;
  openContextMenu(menu: ContextMenu): void;
  closeContextMenu(): void;

  setBaySpan(runId: string, bayId: string, span: SpanMM): void;
  setSpanForBays(runId: string, bayIds: string[], span: SpanMM): void;
  toggleBayStair(runId: string, bayId: string): void;
  setStairForBays(runId: string, bayIds: string[], on: boolean): void;
  /** 開口部（梁枠）の設定。levels=null で解除、数値(1〜3)で開口の高さ（層数） */
  setOpeningForBays(runId: string, bayIds: string[], levels: number | null): void;
  /** コーナー（直角）の勝ち軸を設定。bayId = 向きが変わった直後のベイ */
  setCornerWin(runId: string, bayId: string, win: 'prev' | 'next'): void;
  setRunWidth(runId: string, width: WidthMM): void;
  deleteBay(runId: string, bayId: string): void;
  deleteRun(runId: string): void;
  clearAll(): void;
  undo(): void;
}

const newId = () => Math.random().toString(36).slice(2, 10);

/** 確定済み区間の終端座標 */
function draftEnd(draft: Pick<Draft, 'origin' | 'bays'>): Vec2 {
  return nodePoints({ origin: draft.origin, bays: draft.bays }).at(-1)!;
}

function pushHistory(state: ScaffoldState): Run[][] {
  return [...state.history.slice(-49), state.runs];
}

export const useScaffoldStore = create<ScaffoldState>((set, get) => ({
  runs: [],
  settings: DEFAULT_SETTINGS,
  mode: 'build',
  draft: null,
  selection: null,
  contextMenu: null,
  history: [],

  setMode: (mode) =>
    set((s) => ({
      mode,
      draft: mode === 'build' ? s.draft : null,
      selection: mode === 'select' ? s.selection : null,
      contextMenu: null,
    })),

  updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

  pointerMove: (point) => {
    const { draft } = get();
    if (!draft) return;
    const end = draftEnd(draft);
    const { dir, length } = segmentFrom(end, point);
    const preview: Bay[] = fitSpans(length).map((span) => ({ id: newId(), span, dir }));
    const previewLen = preview.reduce((sum, b) => sum + b.span, 0);
    const cursorEnd: Vec2 = {
      x: end.x + dir.x * previewLen,
      z: end.z + dir.z * previewLen,
    };
    set({ draft: { ...draft, preview, cursorEnd } });
  },

  pointerClick: (point) => {
    const { mode, draft } = get();
    if (mode !== 'build') return;
    if (!draft) {
      const origin = snapPoint(point);
      set({ draft: { origin, bays: [], preview: [], cursorEnd: origin }, selection: null });
      return;
    }
    if (draft.preview.length === 0) {
      // 同じ場所をもう一度クリック → 完成
      get().finishDraft();
      return;
    }
    set({
      draft: {
        ...draft,
        bays: [...draft.bays, ...draft.preview],
        preview: [],
      },
    });
  },

  finishDraft: () => {
    const s = get();
    const draft = s.draft;
    if (!draft) return;
    const bays = [...draft.bays, ...draft.preview];
    if (bays.length === 0) {
      set({ draft: null });
      return;
    }
    const run: Run = {
      id: newId(),
      origin: draft.origin,
      width: s.settings.width,
      bays,
    };
    set({ runs: [...s.runs, run], draft: null, history: pushHistory(s) });
  },

  cancelDraft: () => set({ draft: null }),

  selectBay: (runId, bayId, mods = {}) =>
    set((s) => {
      const run = s.runs.find((r) => r.id === runId);
      if (!run) return s;
      const prev = s.selection;

      // Ctrl: 同じ列内で追加・解除（別の列なら選び直し）
      if (mods.ctrl && prev?.runId === runId) {
        const has = prev.bayIds.includes(bayId);
        const bayIds = has ? prev.bayIds.filter((id) => id !== bayId) : [...prev.bayIds, bayId];
        return { selection: { runId, bayIds }, contextMenu: null };
      }

      // Shift: 直前に選択したベイから範囲選択（同じ列内）
      if (mods.shift && prev?.runId === runId && prev.bayIds.length > 0) {
        const anchorId = prev.bayIds[prev.bayIds.length - 1];
        const idxA = run.bays.findIndex((b) => b.id === anchorId);
        const idxB = run.bays.findIndex((b) => b.id === bayId);
        if (idxA >= 0 && idxB >= 0) {
          const [lo, hi] = idxA <= idxB ? [idxA, idxB] : [idxB, idxA];
          const range = run.bays.slice(lo, hi + 1).map((b) => b.id);
          const merged = [...new Set([...prev.bayIds, ...range])];
          return { selection: { runId, bayIds: merged }, contextMenu: null };
        }
      }

      return { selection: { runId, bayIds: [bayId] }, contextMenu: null };
    }),

  selectBays: (runId, bayIds) => set({ selection: { runId, bayIds: [...bayIds] }, contextMenu: null }),

  selectRun: (runId) => set({ selection: { runId, bayIds: [] }, contextMenu: null }),

  clearSelection: () => set({ selection: null, contextMenu: null }),

  openContextMenu: (menu) => set({ contextMenu: menu }),
  closeContextMenu: () => set({ contextMenu: null }),

  setBaySpan: (runId, bayId, span) => get().setSpanForBays(runId, [bayId], span),

  setSpanForBays: (runId, bayIds, span) =>
    set((s) => ({
      history: pushHistory(s),
      runs: s.runs.map((run) =>
        run.id === runId
          ? { ...run, bays: run.bays.map((b) => (bayIds.includes(b.id) ? { ...b, span } : b)) }
          : run,
      ),
    })),

  toggleBayStair: (runId, bayId) =>
    set((s) => ({
      history: pushHistory(s),
      runs: s.runs.map((run) => {
        if (run.id !== runId) return run;
        const idx = run.bays.findIndex((b) => b.id === bayId);
        if (idx < 0) return run;
        const bays = run.bays.map((b) => ({ ...b }));

        if (bays[idx].isStair) {
          // 解除: このベイを含む連続階段ブロックをまとめて解除
          let lo = idx;
          let hi = idx;
          while (lo > 0 && bays[lo - 1].isStair) lo--;
          while (hi < bays.length - 1 && bays[hi + 1].isStair) hi++;
          for (let i = lo; i <= hi; i++) bays[i].isStair = false;
        } else {
          // 設定: 階段は2スパン1セット（sub-alba 準拠）。
          // 隣のスパン（次を優先、なければ前）とペアで階段化する。
          bays[idx].isStair = true;
          delete bays[idx].openingLevels; // 開口と階段は排他
          const next = idx + 1 < bays.length && !bays[idx + 1].isStair ? idx + 1 : null;
          const prev = idx - 1 >= 0 && !bays[idx - 1].isStair ? idx - 1 : null;
          const partner = next ?? prev;
          if (partner !== null) {
            bays[partner].isStair = true;
            delete bays[partner].openingLevels;
          }
        }
        return { ...run, bays };
      }),
    })),

  setStairForBays: (runId, bayIds, on) => {
    // 単一ベイの階段化は「隣とペアで2スパン1セット」の規則に従う
    if (on && bayIds.length === 1) {
      const run = get().runs.find((r) => r.id === runId);
      const bay = run?.bays.find((b) => b.id === bayIds[0]);
      if (bay && !bay.isStair) {
        get().toggleBayStair(runId, bayIds[0]);
      }
      return;
    }
    set((s) => ({
      history: pushHistory(s),
      runs: s.runs.map((run) =>
        run.id === runId
          ? {
              ...run,
              bays: run.bays.map((b) =>
                bayIds.includes(b.id)
                  ? { ...b, isStair: on, openingLevels: on ? undefined : b.openingLevels }
                  : b,
              ),
            }
          : run,
      ),
    }));
  },

  setOpeningForBays: (runId, bayIds, levels) =>
    set((s) => ({
      history: pushHistory(s),
      runs: s.runs.map((run) =>
        run.id === runId
          ? {
              ...run,
              bays: run.bays.map((b) =>
                bayIds.includes(b.id)
                  ? {
                      ...b,
                      openingLevels: levels === null ? undefined : Math.max(1, Math.min(3, levels)),
                      isStair: levels === null ? b.isStair : false, // 開口と階段は排他
                    }
                  : b,
              ),
            }
          : run,
      ),
    })),

  setCornerWin: (runId, bayId, win) =>
    set((s) => ({
      history: pushHistory(s),
      runs: s.runs.map((run) =>
        run.id === runId
          ? { ...run, bays: run.bays.map((b) => (b.id === bayId ? { ...b, cornerWin: win } : b)) }
          : run,
      ),
    })),

  setRunWidth: (runId, width) =>
    set((s) => ({
      history: pushHistory(s),
      runs: s.runs.map((run) => (run.id === runId ? { ...run, width } : run)),
    })),

  deleteBay: (runId, bayId) =>
    set((s) => {
      const runs = s.runs
        .map((run) =>
          run.id === runId ? { ...run, bays: run.bays.filter((b) => b.id !== bayId) } : run,
        )
        .filter((run) => run.bays.length > 0);
      const stillExists = runs.some((r) => r.id === runId);
      const selection =
        s.selection?.runId === runId
          ? stillExists
            ? { runId, bayIds: s.selection.bayIds.filter((id) => id !== bayId) }
            : null
          : s.selection;
      return { runs, selection, history: pushHistory(s), contextMenu: null };
    }),

  deleteRun: (runId) =>
    set((s) => ({
      history: pushHistory(s),
      runs: s.runs.filter((run) => run.id !== runId),
      selection: s.selection?.runId === runId ? null : s.selection,
      contextMenu: null,
    })),

  clearAll: () =>
    set((s) => ({
      history: pushHistory(s),
      runs: [],
      draft: null,
      selection: null,
      contextMenu: null,
    })),

  undo: () =>
    set((s) => {
      if (s.history.length === 0) return s;
      const history = [...s.history];
      const runs = history.pop()!;
      return { runs, history, selection: null, contextMenu: null };
    }),
}));

// E2Eテスト・デバッグ用にストアを公開（ブラウザのみ）
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__scaffoldStore = useScaffoldStore;
}
