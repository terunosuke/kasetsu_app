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

export interface Selection {
  runId: string;
  bayId: string | null;
}

interface ScaffoldState {
  runs: Run[];
  settings: GlobalSettings;
  mode: Mode;
  draft: Draft | null;
  selection: Selection | null;
  history: Run[][];

  setMode(mode: Mode): void;
  updateSettings(patch: Partial<GlobalSettings>): void;

  pointerMove(point: Vec2): void;
  pointerClick(point: Vec2): void;
  finishDraft(): void;
  cancelDraft(): void;

  select(sel: Selection | null): void;
  setBaySpan(runId: string, bayId: string, span: SpanMM): void;
  toggleBayStair(runId: string, bayId: string): void;
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
  history: [],

  setMode: (mode) =>
    set((s) => ({
      mode,
      draft: mode === 'build' ? s.draft : null,
      selection: mode === 'select' ? s.selection : null,
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

  select: (selection) => set({ selection }),

  setBaySpan: (runId, bayId, span) =>
    set((s) => ({
      history: pushHistory(s),
      runs: s.runs.map((run) =>
        run.id === runId
          ? { ...run, bays: run.bays.map((b) => (b.id === bayId ? { ...b, span } : b)) }
          : run,
      ),
    })),

  toggleBayStair: (runId, bayId) =>
    set((s) => ({
      history: pushHistory(s),
      runs: s.runs.map((run) =>
        run.id === runId
          ? {
              ...run,
              bays: run.bays.map((b) => (b.id === bayId ? { ...b, isStair: !b.isStair } : b)),
            }
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
      const selection =
        s.selection?.bayId === bayId
          ? runs.some((r) => r.id === runId)
            ? { runId, bayId: null }
            : null
          : s.selection;
      return { runs, selection, history: pushHistory(s) };
    }),

  deleteRun: (runId) =>
    set((s) => ({
      history: pushHistory(s),
      runs: s.runs.filter((run) => run.id !== runId),
      selection: s.selection?.runId === runId ? null : s.selection,
    })),

  clearAll: () =>
    set((s) => ({
      history: pushHistory(s),
      runs: [],
      draft: null,
      selection: null,
    })),

  undo: () =>
    set((s) => {
      if (s.history.length === 0) return s;
      const history = [...s.history];
      const runs = history.pop()!;
      return { runs, history, selection: null };
    }),
}));
