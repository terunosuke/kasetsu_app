# 次世代足場 3Dシミュレーション＆数量拾いアプリ 設計書

対象: アルバトロス等のくさび緊結式・次世代足場
スタック: Next.js (TypeScript) / React Three Fiber / Zustand / Tailwind CSS

既存の `types.ts` / `constants.ts`（フォーム入力型拾い出しツール）のドメイン知識
（スパン 600/900/1200/1500/1800、支柱 450/900/1800/2700/3600、アンチ・巾木・
ブレス・妻側部材・ジャッキベース等の規格と単重）を 3D 配置モデルへ発展させる。

---

## 1. データモデル（TypeScript 型定義）

設計の核心は **「3層構造」** で、これが連動性・拡張性の土台になる。

| 層 | 内容 | 永続化 |
|---|---|---|
| ① 規格マスタ層 | 部材カタログ・寸法適合ルール（不変データ） | 静的定義（将来はJSON/DB） |
| ② 配置層 | ユーザーが操作する**パラメータのみ**（節点・スパン・層構成） | ストアに保存 |
| ③ 派生層 | 部材インスタンス・BOM（数量表）— **常に①②から計算** | 保存しない |

> **原則: ストアに保存するのはパラメータだけ。部材リストは常に導出する。**
> これにより「スパンを変えたら踏板・手すりが追従する」が、
> 同期処理なしで構造的に保証される。

### 1-1. 規格マスタ層（catalog）

```ts
// ===== 単位は全て mm / kg =====

/** 足場システム（メーカー規格）。将来の規格追加はここに増やす */
export type ScaffoldSystem = 'albatross' | 'generic-wedge';

/** 長手方向スパン規格 */
export type SpanMM = 600 | 900 | 1200 | 1500 | 1800;

/** 短手（妻側）方向の足場幅規格 */
export type WidthMM = 450 | 600 | 900 | 1200;

/** 支柱の規格長 */
export type PillarMM = 450 | 900 | 1800 | 2700 | 3600;

/** くさびポケットのピッチ（層高さはこの倍数） */
export const LIFT_PITCH_MM = 450;

/** 部材種別 */
export type PartKind =
  | 'pillar'         // 支柱
  | 'ledger'         // 長手布材
  | 'transom'        // 短手布材（アンチ受け）
  | 'deck'           // アンチ（布板・踏板）
  | 'handrail'       // 長手手すり
  | 'brace'          // ブレス（筋交）
  | 'toeboard'       // 巾木
  | 'tsumaHandrail'  // 妻側手すり
  | 'tsumaToeboard'  // 妻側巾木
  | 'jackBase'       // ジャッキベース
  | 'stair'          // 階段
  | 'basePlate'      // 敷板
  | 'joint';         // タイコ等ジョイント

/** 部材規格（カタログの1行）。視覚精度は不要だが寸法・単重は正確に持つ */
export interface PartSpec {
  id: string;              // 例: 'deck-1800-500'
  system: ScaffoldSystem;
  kind: PartKind;
  name: string;            // 例: 'アンチ1800/50'（既存 WEIGHT_DICT のキーと対応）
  lengthMm?: number;       // 長手方向寸法
  widthMm?: number;        // 短手方向寸法
  unitWeightKg: number;
}

export type PartCatalog = Record<string, PartSpec>;

/**
 * 【連動性の中核】スパン長 → 適合部材の対応表。
 * 「スパンを1200→1500に変えたら手すり・ブレス・巾木・アンチが
 *  1500用に置き換わる」のはこのルックアップで実現する。
 */
export interface SpanFittingRule {
  span: SpanMM;
  handrailSpecId: string;
  braceSpecId: string;
  toeboardSpecId: string;
  /** アンチはスパン長×幅の2軸で決まる: 幅ごとの敷き並べ構成 */
  deckLayoutByWidth: Record<WidthMM, string[]>; // 例: 900幅 → ['deck-1800-500', 'deck-1800-400']
}

/** 足場幅 → 妻側部材の対応表 */
export interface WidthFittingRule {
  width: WidthMM;
  transomSpecId: string;
  tsumaHandrailSpecId: string;
  tsumaToeboardSpecId: string;
}

/** システム一式のマスタ定義 */
export interface SystemCatalog {
  system: ScaffoldSystem;
  parts: PartCatalog;
  spanRules: Record<SpanMM, SpanFittingRule>;
  widthRules: Record<WidthMM, WidthFittingRule>;
  pillarLengths: PillarMM[];
}
```

※ アンチの敷き並べ構成（幅900 = 500+400 等）はメーカーにより異なるため、
コードにハードコードせず `deckLayoutByWidth` の**マスタデータ**として持たせ、
規格差し替えを可能にする。

### 1-2. 配置層（ユーザー操作対象 = Single Source of Truth）

建物外周に沿う足場を「**節点（支柱位置）＋辺（スパン）のグラフ**」で表現する。
隣接スパンが支柱を共有するため、Bay（スパン枠）の配列ではなくグラフにするのが
数量計算（支柱の重複排除）と入隅・出隅対応の両面で正しい。

```ts
export interface Vec2 { x: number; y: number; } // 平面座標 (mm)

/** 節点 = 支柱の建て位置。グリッドスナップ済みの座標を持つ */
export interface PostNode {
  id: string;
  position: Vec2;
}

/** 辺 = 1スパン。パラメータのみ持ち、部材は持たない */
export interface SpanEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  span: SpanMM;      // 不変条件: |to - from| === span
  width: WidthMM;    // このスパンの足場幅
  side: 1 | -1;      // 進行方向に対しどちら側へ幅を取るか（建物の外側）
}

/** 1層（リフト）の構成。MVPでは1層目のみだが最初から配列で持つ */
export interface Lift {
  index: number;        // 1層目 = 1
  heightMm: number;     // 通常 1800（LIFT_PITCH_MM の倍数）
  hasDeck: boolean;     // アンチ有無
  hasToeboard: boolean;
  handrail: 'both' | 'outerOnly' | 'none';
  hasStair: boolean;
}

/** ひと続きの足場ライン（将来は建物ごと・工区ごとに複数持てる） */
export interface ScaffoldRun {
  id: string;
  nodeIds: string[];    // 経路順
  edgeIds: string[];    // 経路順（nodeIds.length - 1 本）
  lifts: Lift[];        // MVP: 全スパン共通の層構成。将来 edge 単位で上書き可
  jackBase: 'SB20' | 'SB40';
  hasBasePlate: boolean; // 敷板
}

/** プロジェクト全体（正規化して保持 → 部分更新・購読が速い） */
export interface ScaffoldProject {
  id: string;
  name: string;
  system: ScaffoldSystem;
  gridPitchMm: number;               // スナップグリッド（通常 300 か 150）
  nodes: Record<string, PostNode>;
  edges: Record<string, SpanEdge>;
  runs: Record<string, ScaffoldRun>;
}
```

### 1-3. 派生層（保存しない・常に計算）

```ts
/** 3D描画と数量集計の両方が使う中間表現 */
export interface PartInstance {
  specId: string;                    // PartSpec への参照
  sourceEdgeId?: string;             // どのスパン由来か（選択ハイライト用）
  sourceNodeId?: string;
  liftIndex?: number;
  transform: {
    position: [number, number, number]; // 3D座標 (m ではなく mm、描画時に scale)
    rotationY: number;
  };
}

/** 数量表（BOM） */
export interface BomRow {
  specId: string;
  name: string;
  quantity: number;
  unitWeightKg: number;
  totalWeightKg: number;
}

export interface BillOfMaterials {
  rows: BomRow[];
  totalWeightKg: number;
}
```

導出パイプライン（純関数のみで構成、テスト容易）:

```
(SystemCatalog, ScaffoldProject)
   → resolveParts()      … グラフを走査し PartInstance[] を生成
       ・支柱: node ごとに層高さ合計から PillarMM の組合せを解決（共有支柱は1回だけ）
       ・スパン部材: edge.span → SpanFittingRule でスペック解決
       ・妻側部材: run の端点 edge のみに付与
   → aggregateBom()      … specId で group-by して数量・重量集計
   → toCsv()             … CSV 文字列化（既存ツールの出力形式を踏襲）
```

---

## 2. 状態管理（Zustand）の設計思想

### 2-1. 原則: 「パラメータが真実、部材は導出」

連動性を **イベント連鎖（スパン変更 → 手すり更新イベント → …）で実装しない**。
イベント連鎖は同期漏れ・順序バグの温床になる。代わりに:

- ストアには配置層（`nodes` / `edges` / `runs`）**だけ**を置く
- 踏板・手すり・ブレス等は `edge.span` からセレクタで**毎回導出**する
- よって「スパン変更時に踏板が追従する」のは *更新処理* ではなく
  *参照の再計算* であり、追従漏れが原理的に起きない

```ts
// store/scaffoldStore.ts の骨子
interface ScaffoldState {
  project: ScaffoldProject;

  // --- actions: パラメータのみを書き換える ---
  addSpan(fromNodeId: string, direction: Vec2, span: SpanMM): void;
  updateEdgeSpan(edgeId: string, span: SpanMM): void;   // ← toNode 座標も同時に再配置
  updateEdgeWidth(edgeId: string, width: WidthMM): void;
  setLifts(runId: string, lifts: Lift[]): void;
  removeEdge(edgeId: string): void;
}

export const useScaffoldStore = create<ScaffoldState>()(
  subscribeWithSelector(immer((set) => ({ /* ... */ })))
);
```

`updateEdgeSpan` が守る不変条件は「終点ノード座標 = 始点 + 方向 × span」のみ。
手すり・アンチには一切触らない。触らなくても追従する、が設計の要点。

### 2-2. 導出はメモ化セレクタで

```ts
// selectors/bom.ts
export const selectPartInstances = (s: ScaffoldState) =>
  resolveParts(catalog, s.project);        // edge 単位でメモ化キャッシュ

export const selectBom = (s: ScaffoldState) =>
  aggregateBom(selectPartInstances(s));
```

- `resolveParts` は **edge 単位でメモ化**（キー: edge のパラメータ + lifts のハッシュ）。
  1スパンの変更で再計算されるのはそのスパン分だけ → 大規模配置でもリアルタイム集計可
- BOM テーブル・CSV 出力・3D 描画は全て同じ `PartInstance[]` を参照
  → 「画面の絵」と「拾い出し数量」が絶対に食い違わない

### 2-3. React Three Fiber との接続

- 各 3D コンポーネントは **自分に関係するエンティティだけを購読**する
  ```ts
  const edge = useScaffoldStore(s => s.project.edges[edgeId]);
  ```
  → スパン変更時に再レンダーされるのは該当 `<SpanGroup>` のみ
- メッシュ寸法は `edge.span` / `edge.width` から算出した `scale` / `position` を
  props で渡すだけ。ジオメトリは規格ごとに `useMemo` で共有し、
  同一規格の大量描画は将来 `InstancedMesh` に差し替え可能な構造にする
- **ドラッグ中のゴースト表示は uiSlice に隔離**（`draftEdge` 等の一時状態）。
  確定（クリック/ドロップ）時に初めて `addSpan` でプロジェクト本体へコミット。
  → 60fps のポインタ移動で BOM 再計算が走らない
- グリッドスナップは純関数 `snapToGrid(point, gridPitchMm, spanRules)` として
  logic 層に置き、3D 層はそれを呼ぶだけ（テスト可能・2D平面図ビューへも転用可）

### 2-4. スライス構成と将来拡張

| スライス | 内容 |
|---|---|
| `projectSlice` | nodes / edges / runs（永続化対象、undo/redo 対象） |
| `uiSlice` | 選択中ツール、hover/selected ID、ドラフト状態、カメラモード |
| `catalogSlice` | SystemCatalog（読み取り専用。将来ユーザー定義規格をロード） |

- 状態が全て plain object なので、undo/redo は `zundo`（temporal middleware）を
  `projectSlice` に被せるだけで後付けできる
- 保存/読込は `ScaffoldProject` の JSON シリアライズのみ（派生層は保存しない）
- **階数の積み上げ**: `Lift[]` を増やすだけで支柱解決・BOM が自動追従する。
  1層目 MVP の時点でデータ構造は多層前提になっている

---

## 3. ディレクトリ構成案（Next.js App Router）

```
scaffolding-3d/
├── src/
│   ├── app/                          # ルーティングのみ（薄く保つ）
│   │   ├── layout.tsx
│   │   ├── page.tsx                  # エディタ画面（<Editor /> を配置するだけ）
│   │   └── globals.css               # Tailwind
│   │
│   ├── features/scaffold/            # ドメイン一式（責務分離の単位）
│   │   ├── catalog/                  # ① 規格マスタ層
│   │   │   ├── types.ts              #    PartSpec / FittingRule 等
│   │   │   ├── albatross.ts          #    アルバトロス規格データ（単重は既存 WEIGHT_DICT 移植）
│   │   │   └── index.ts              #    getCatalog(system)
│   │   │
│   │   ├── model/                    # ② 配置層の型とジオメトリ純関数
│   │   │   ├── types.ts              #    PostNode / SpanEdge / Lift / ScaffoldProject
│   │   │   ├── grid.ts               #    snapToGrid, 方向・角度ユーティリティ
│   │   │   └── invariants.ts         #    バリデーション（既存 ValidationResults の発展）
│   │   │
│   │   ├── logic/                    # ③ 派生層（純関数のみ・React 非依存）
│   │   │   ├── resolveParts.ts       #    グラフ → PartInstance[]
│   │   │   ├── resolvePillars.ts     #    層高さ合計 → 支柱組合せ解決
│   │   │   ├── aggregateBom.ts       #    PartInstance[] → BillOfMaterials
│   │   │   └── exportCsv.ts          #    BOM → CSV
│   │   │
│   │   ├── store/                    # Zustand
│   │   │   ├── scaffoldStore.ts      #    スライス合成
│   │   │   ├── projectSlice.ts
│   │   │   ├── uiSlice.ts
│   │   │   └── selectors.ts          #    selectPartInstances / selectBom（メモ化）
│   │   │
│   │   ├── three/                    # R3F 描画（'use client'）
│   │   │   ├── ScaffoldCanvas.tsx    #    <Canvas> + カメラ + ライト
│   │   │   ├── SceneRoot.tsx         #    project を購読して構造を展開
│   │   │   ├── SpanGroup.tsx         #    1スパン分の部材群（edge 購読）
│   │   │   ├── parts/                #    PillarMesh / DeckMesh / HandrailMesh ...
│   │   │   ├── PlacementController.tsx #  ポインタ→スナップ→ドラフト→コミット
│   │   │   └── SnapGuide.tsx         #    スナップ位置のゴースト表示
│   │   │
│   │   └── ui/                       # 2D UI（Tailwind）
│   │       ├── Toolbar.tsx           #    配置/選択/削除モード切替
│   │       ├── ParamPanel.tsx        #    選択スパンの span/width/lifts 編集
│   │       ├── BomTable.tsx          #    リアルタイム数量表
│   │       └── ExportButton.tsx      #    CSV ダウンロード
│   │
│   └── lib/                          # 汎用ユーティリティ（download, id生成 等）
│
├── tests/                            # logic/ と model/ の単体テスト（vitest）
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

### 責務分離の狙い

- **`logic/` と `model/` は React にも Three.js にも依存しない純 TypeScript**
  → 数量計算のテストがブラウザ不要で書け、既存フォーム版ツールとの
  突き合わせ検証（同条件で同数量になるか）も CI で回せる
- **`three/` は「ストアを購読して描くだけ」**、**`ui/` は「ストアを購読して編集するだけ」**
  → 3D と 2D パネルが同じ真実（パラメータ）を見るため、双方向同期コードが不要
- 既存リポジトリのフォーム版（ルート直下の Vite アプリ）は当面残し、
  `scaffolding-3d/` を新規ディレクトリとして並置 → 検証用のリファレンスにする

---

## 4. MVP 実装ステップ（参考）

1. `catalog/` + `model/` + `logic/` を先に実装し、単体テストで数量計算を固める
   （既存 `useScaffoldingCalculator` の結果と突き合わせ）
2. Zustand ストア + `BomTable`（3D なしでパラメータ→数量のリアクティブ性を確認）
3. R3F: 静的描画（`SceneRoot` がストアを描くだけ）
4. `PlacementController`: グリッドスナップ配置・スパン編集
5. CSV 出力・妻側/階段オプション → 1層目 MVP 完成
6. `Lift[]` 複数化で多層対応（データ構造は変更不要）
