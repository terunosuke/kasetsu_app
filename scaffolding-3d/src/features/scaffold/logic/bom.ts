/**
 * 配置（Run[]）＋全体設定 → 部材数量表（BOM）の導出。
 * 数量ルールは sub-alba の拾い出し計算に準拠（列数=1 の単列足場）:
 *   - ジャッキベース・支柱・根がらみ: 建地箇所数 = 節点数 × 2列
 *   - 長手手すり: スパン × 段数 × 2 ／ ブレス: スパン × 段数 × 1
 *   - アンチ: スパン × アンチ設置段 × 枠幅ごとの敷き並べ構成
 *   - 巾木: スパン × 巾木設置段 × 面数(2/1/0)
 *   - 短手布材: 節点数 × 段数
 *   - 妻側手すり: 列端部数 × アンチ設置段 × 2段手すり ／ 妻側巾木: × 1
 *   - 敷板: 列全長を 4m/3m/2m で貪欲に割付 × 2列
 *   - 階段: 階段スパン数 × 階段設置段（スパンの階段化は3D側で指定）
 *   - 階段拡幅（sub-alba のアルバトロス拡幅ルール）:
 *       枠幅914: 内3列 短手布材914→1219差替 ＋ 外2列 短手布材305追加
 *                ＋ 階段スパンと隣接スパンのアンチ24→50差替
 *       その他: 短手布材305 × 5列 × 段数
 *       共通: 階段1セットにつき建地2箇所分のジャッキ・支柱・根がらみを追加
 *   - 壁つなぎ: 設置段数 × 1段あたり設置数（全部/千鳥/指定）
 *   - 層間ネット: 段数 × ceil(全長/5.5m)、ブラケット: 段数 × 節点数
 *   - メッシュシート: スパンサイズごと × ceil(設置段/3)、妻側は枠幅ごと
 */
import {
  DECK_LAYOUT,
  OPENING_SPLE_NAME,
  SPEC_MAP,
  SPS_NAME,
  WALL_TIE_NAME,
  WEIGHT_DICT,
  beamForOpening,
} from '../catalog/albatross';
import { pillarComboFor } from '../model/fitting';
import {
  SPANS,
  WIDTHS,
  cumulativeHeights,
  openingGroups,
  openingInteriorNodes,
  resolveAntiLevels,
  resolveStairLevels,
  resolveToeboardLevels,
  runLength,
  runSegments,
  stairGroups,
  totalHeightMm,
  widenedBaySet,
  type GlobalSettings,
  type PillarSelection,
  type Run,
} from '../model/types';

export interface BomRow {
  name: string;
  spec: string;
  quantity: number;
  unitWeightKg: number;
  totalWeightKg: number;
}

export interface BomValidation {
  /** 支柱手動構成と総高さの整合（null = 自動解決なので常に整合） */
  pillarStatus: 'auto' | 'ok' | 'mismatch';
  pillarHeightMm: number; // 手動構成の合計高さ
  /** ジャッキベース custom 時の過不足 */
  jackBaseStatus: 'ok' | 'under' | 'over';
  jackBaseNeeded: number;
  jackBaseProvided: number;
  /** 梁わく上限（7200mm）を超えた開口幅のリスト（マルチトラス材等の個別対応が必要） */
  openingOverLimit: number[];
}

export interface Bom {
  rows: BomRow[];
  totalWeightKg: number;
  totalLengthMm: number;
  totalHeightMm: number;
  bayCount: number;
  stairCount: number; // 階段セット数
  openingCount: number; // 開口部（梁枠）の数
  cornerCount: number; // 直角コーナー数
  nodeCount: number;
  pillarText: string;
  transportUnic: string;
  transportFlatbed: string;
  splitOptions: string[];
  validation: BomValidation;
}

/** CSV・表の表示順（sub-alba の ordered_keys に準拠） */
function orderedKeys(): string[] {
  const pillarKeys = [225, 450, 900, 1350, 1800, 2700, 3600].map((l) => `支柱（${l}）`);
  const bySpan = (label: string) => SPANS.map((s) => `${label}（${s}）`);
  const byWidth = (label: string) => WIDTHS.map((w) => `${label}（${w}）`);
  const antiKeys = SPANS.flatMap((s) => ['24', '50', '40'].map((t) => `アンチ（${t}/${s}）`));
  return [
    '敷板（4m）',
    '敷板（3m）',
    '敷板（2m）',
    'ジャッキベース（20）',
    'ジャッキベース（40）',
    'タイコ（40）',
    'タイコ（80）',
    ...pillarKeys,
    '根がらみ支柱',
    ...bySpan('ブレス'),
    ...bySpan('長手手すり'),
    '短手布材（305）',
    ...byWidth('短手布材'),
    ...antiKeys,
    '階段（セット）',
    '梁わく（SPL36）',
    '梁わく（SPL54）',
    '梁わく（SPL72）',
    '梁わく受け金具（SPLT）',
    '床付き布わく受けパイプ（SPLE4）',
    '床付き布わく受けパイプ（SPLE6）',
    '床付き布わく受けパイプ（SPLE9）',
    '床付き布わく受けパイプ（SPLE12）',
    '方杖（SPS18）',
    '方杖（SPS15）',
    '方杖（SPS12）',
    '方杖（SPS9）',
    ...bySpan('巾木'),
    ...byWidth('妻側手すり'),
    ...byWidth('妻側巾木'),
    ...Object.values(WALL_TIE_NAME),
    '層間ネット',
    '層間ネットブラケット',
    ...SPANS.map((s) => `妻側メッシュシート（${s}）`),
    ...SPANS.map((s) => `メッシュシート（${s}）`),
  ];
}

/** 支柱構成（1建地あたり）を決める: 手動指定があればそれ、なければ高さから自動 */
export function effectivePillarCombo(s: GlobalSettings): PillarSelection {
  if (s.pillarOverride) return s.pillarOverride;
  return pillarComboFor(totalHeightMm(s));
}

export function pillarComboText(combo: PillarSelection): string {
  const parts = Object.entries(combo)
    .filter(([, n]) => n > 0)
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([len, n]) => `${len}×${n}本`);
  return parts.length > 0 ? parts.join('、') : 'なし';
}

export function computeBom(runs: Run[], s: GlobalSettings): Bom {
  const q = new Map<string, number>();
  const add = (key: string, n: number) => {
    if (n > 0) q.set(key, (q.get(key) ?? 0) + n);
  };
  const sub = (key: string, n: number) => {
    if (n <= 0) return;
    q.set(key, Math.max(0, (q.get(key) ?? 0) - n));
  };
  /** 差替（既存数量から減らして別部材へ付け替え） */
  const swap = (fromKey: string, toKey: string, n: number) => {
    if (n <= 0) return;
    const cur = q.get(fromKey) ?? 0;
    const moved = Math.min(cur, n);
    q.set(fromKey, cur - moved);
    add(toKey, moved);
  };

  const levels = s.levels;
  const heightMm = totalHeightMm(s);
  const antiLevels = resolveAntiLevels(s);
  const toeLevels = resolveToeboardLevels(s);
  const stairLevels = resolveStairLevels(s);
  const toeFaces = s.toeboardFaces === 'both' ? 2 : s.toeboardFaces === 'single' ? 1 : 0;
  const pillarCombo = effectivePillarCombo(s);
  // 側面構成 → 1スパン1段あたりの手すり本数（二段手摺=2本/面）とブレス本数（×型=1本/面）
  const railsPerBayLevel = s.sideMode === 'bothRail' ? 4 : s.sideMode === 'braceAndRail' ? 2 : 0;
  const bracesPerBayLevel = s.sideMode === 'bothBrace' ? 2 : s.sideMode === 'braceAndRail' ? 1 : 0;

  let totalLengthMm = 0;
  let bayCount = 0;
  let stairSetCount = 0; // 階段セット数（1セット = 連続する最大2スパン）
  let openingCount = 0; // 開口部（梁枠）の数
  let interiorNodeCount = 0; // 開口内部の節点数（地上に建地が無い）
  let cornerCount = 0; // 直角コーナー数
  let cornerSharedNodeCount = 0; // コーナーで支柱兼用となる節点数（ジャッキ不要）
  const openingOverLimit: number[] = []; // 梁わく上限超過の開口幅
  const cumsMm = cumulativeHeights(s);
  let nodeCount = 0;

  const activeRuns = runs.filter((r) => r.bays.length > 0);

  for (const run of activeRuns) {
    // 直線区間とコーナー。コーナーでは節点が両区間に1つずつでき、合計は bays+1+コーナー数
    const { segments } = runSegments(run);
    const perpCorners = segments
      .map((seg) => seg.cornerAtStart)
      .filter((c): c is NonNullable<typeof c> => !!c && c.perpendicular);
    const nodes = run.bays.length + 1 + perpCorners.length;
    const legs = nodes * 2; // 内外2列分の建地
    nodeCount += nodes;
    bayCount += run.bays.length;
    for (const seg of segments) stairSetCount += stairGroups(seg.bays).length;

    for (const [len, count] of Object.entries(pillarCombo)) {
      add(`支柱（${len}）`, count * legs);
    }
    if (s.jackBaseMode !== 'none' && s.negarami) add('根がらみ支柱', legs);

    for (const bay of run.bays) {
      add(`長手手すり（${bay.span}）`, levels * railsPerBayLevel);
      add(`ブレス（${bay.span}）`, levels * bracesPerBayLevel);
      if (toeFaces > 0) add(`巾木（${bay.span}）`, toeLevels.length * toeFaces);
      for (const deckType of DECK_LAYOUT[run.width]) {
        add(`アンチ（${deckType}/${bay.span}）`, antiLevels.length);
      }
    }

    add(`短手布材（${run.width}）`, nodes * levels);

    if (s.tsumaCount > 0) {
      add(`妻側手すり（${run.width}）`, s.tsumaCount * antiLevels.length * 2); // 2段手すり
      const tsumaToeKey = `妻側巾木（${run.width}）`;
      if (WEIGHT_DICT[tsumaToeKey] !== undefined) {
        add(tsumaToeKey, s.tsumaCount * antiLevels.length);
      }
    }

    const len = runLength(run);
    totalLengthMm += len;

    if (s.jackBaseMode !== 'none' && s.basePlate) {
      let rest = len;
      const n4 = Math.floor(rest / 4000);
      rest -= n4 * 4000;
      const n3 = Math.floor(rest / 3000);
      rest -= n3 * 3000;
      let n2 = Math.floor(rest / 2000);
      rest -= n2 * 2000;
      if (rest > 0) n2 += 1;
      add('敷板（4m）', n4 * 2);
      add('敷板（3m）', n3 * 2);
      add('敷板（2m）', n2 * 2);
    }

    // --- 開口部（梁わく）: 開口用梁カタログ準拠 ---
    //   ・梁わく（SPL）は両構面に2本／開口
    //   ・梁わく受け金具（SPLT）は 4個／開口
    //   ・床付き布わく受けパイプ（SPLE 枠幅対応）は開口内部の節点数（スパン数−1）
    //   ・方杖（SPS）は SPL54・72 のとき 4本／開口
    //   ・7200mm 超の開口は梁わく適用外 → 検証エラー（マルチトラス材を別途）
    //   ・開口内部の節点は梁わく上に支柱を挿す（地上〜梁わく間の支柱・ジャッキ・根がらみなし）
    //   ・開口層の壁面部材（手すり/ブレス/アンチ/巾木/短手布材）を差し引く
    for (const seg of segments)
    for (const g of openingGroups(seg.bays)) {
      openingCount += 1;
      const oLv = Math.min(g.levels, levels);
      const interior = openingInteriorNodes(g);
      interiorNodeCount += interior.length;

      const beam = beamForOpening(g.lengthMm);
      if (beam) {
        add(beam.name, 2);
        add('梁わく受け金具（SPLT）', 4);
        add(OPENING_SPLE_NAME[run.width], interior.length);
        if (beam.needsBrace) add(SPS_NAME[s.spsSize], 4);
      } else {
        openingOverLimit.push(g.lengthMm);
      }

      // 支柱: 内部節点の全高分を引き、梁枠上（総高さ−開口高さ）分を積み直す
      const shortHeightMm = heightMm - cumsMm[oLv];
      for (const [len, count] of Object.entries(pillarCombo)) {
        sub(`支柱（${len}）`, count * interior.length * 2);
      }
      if (shortHeightMm > 0) {
        for (const [len, count] of Object.entries(pillarComboFor(shortHeightMm))) {
          add(`支柱（${len}）`, count * interior.length * 2);
        }
      }
      if (s.jackBaseMode !== 'none' && s.negarami) sub('根がらみ支柱', interior.length * 2);

      sub(`短手布材（${run.width}）`, interior.length * oLv);

      for (const bi of g.bayIndices) {
        const bay = seg.bays[bi];
        sub(`長手手すり（${bay.span}）`, oLv * railsPerBayLevel);
        sub(`ブレス（${bay.span}）`, oLv * bracesPerBayLevel);
        const antiInOpening = antiLevels.filter((l) => l <= oLv).length;
        for (const deckType of DECK_LAYOUT[run.width]) {
          sub(`アンチ（${deckType}/${bay.span}）`, antiInOpening);
        }
        if (toeFaces > 0) {
          const toeInOpening = toeLevels.filter((l) => l <= oLv).length;
          sub(`巾木（${bay.span}）`, toeInOpening * toeFaces);
        }
      }
    }

    // --- コーナー（L字直角）: 勝ち軸に端部手すり・負け軸コーナー節点は支柱兼用 ---
    //   ・端部手すり: 妻側手すり（二段）× アンチ設置段
    //   ・支柱兼用: 負け軸コーナー節点の建地（内外2本）の支柱・ジャッキ・根がらみを省略
    for (const c of perpCorners) {
      void c;
      cornerCount += 1;
      cornerSharedNodeCount += 1;
      add(`妻側手すり（${run.width}）`, antiLevels.length * 2);
      for (const [len, count] of Object.entries(pillarCombo)) {
        sub(`支柱（${len}）`, count * 2);
      }
      if (s.jackBaseMode !== 'none' && s.negarami) sub('根がらみ支柱', 2);
    }
  }

  // --- ジャッキベース（節点×2列。custom 時は入力値をそのまま採用。コーナー兼用節点は不要） ---
  const jackBaseNeeded =
    s.jackBaseMode !== 'none' ? (nodeCount - interiorNodeCount - cornerSharedNodeCount) * 2 : 0;
  const stairExtraNodes = s.stairWidening ? 2 * stairSetCount : 0; // 拡幅時の追加建地（外2列/セット）
  if (s.jackBaseMode !== 'none') {
    if (s.jackBaseOption === 'allSB20') add('ジャッキベース（20）', jackBaseNeeded + stairExtraNodes);
    else if (s.jackBaseOption === 'allSB40') add('ジャッキベース（40）', jackBaseNeeded + stairExtraNodes);
    else {
      add('ジャッキベース（20）', s.sb20Count);
      add('ジャッキベース（40）', s.sb40Count);
    }
  }
  if (s.jackBaseMode === 'jackWithTaiko') {
    add('タイコ（40）', s.taiko40);
    add('タイコ（80）', s.taiko80);
  }

  // --- 階段（セット）と拡幅（sub-alba のアルバトロス拡幅ルール） ---
  if (stairSetCount > 0) {
    add('階段（セット）', stairSetCount * stairLevels.length);

    if (s.stairWidening) {
      // 追加建地分の支柱・根がらみ（外2列 × セット数）
      for (const [len, count] of Object.entries(pillarCombo)) {
        add(`支柱（${len}）`, count * stairExtraNodes);
      }
      if (s.jackBaseMode !== 'none' && s.negarami) add('根がらみ支柱', stairExtraNodes);

      for (const run of activeRuns) {
        for (const seg of runSegments(run).segments) {
          const groups = stairGroups(seg.bays);
          if (groups.length === 0) continue;

          if (run.width === 914) {
            for (const group of groups) {
              // 内列（セット内の節点 = スパン数+1）: 短手布材 914 → 1219 差替
              //   2スパンセットで 3列 = sub-alba の「内3列」
              swap('短手布材（914）', '短手布材（1219）', (group.length + 1) * levels);
              // 外2列: 914ラインの追加建地に 305 を追加
              add('短手布材（305）', 2 * levels);
            }
            // 拡幅範囲（階段セット＋両隣）のアンチ 24 → 50 差替
            for (const i of widenedBaySet(seg.bays)) {
              const span = seg.bays[i].span;
              swap(`アンチ（24/${span}）`, `アンチ（50/${span}）`, antiLevels.length);
            }
          } else {
            add('短手布材（305）', 5 * groups.length * levels);
          }
        }
      }
    }
  }

  // --- 壁つなぎ ---
  if (s.wallTieMode !== 'none' && bayCount > 0) {
    const tieLevels =
      s.wallTieLevelMode === 'all'
        ? levels
        : s.wallTieLevelMode === 'alternate'
          ? Math.ceil(levels / 2)
          : s.wallTieLevelCount;
    const tieSpans =
      s.wallTieSpanMode === 'all'
        ? bayCount
        : s.wallTieSpanMode === 'alternate'
          ? Math.ceil((bayCount + 1) / 2)
          : s.wallTieSpanCount;
    add(WALL_TIE_NAME[s.wallTieMode], tieLevels * tieSpans);
  }

  // --- 層間養生ネット ---
  if (s.layerNet && bayCount > 0) {
    const netLevels =
      s.layerNetLevelMode === 'all'
        ? levels
        : s.layerNetLevelMode === 'alternate'
          ? Math.ceil(levels / 2)
          : s.layerNetLevelCount;
    if (netLevels > 0) {
      add('層間ネット', netLevels * Math.ceil(totalLengthMm / 5500));
      add('層間ネットブラケット', netLevels * nodeCount);
    }
  }

  // --- 外周メッシュシート ---
  if (s.sheet && bayCount > 0) {
    const sheetLevels = s.sheetLevelMode === 'all' ? levels : s.sheetLevelCount;
    if (sheetLevels > 0) {
      const sheetsPerSpan = Math.ceil(sheetLevels / 3); // 3段/1枚
      for (const run of activeRuns) {
        for (const bay of run.bays) {
          add(`メッシュシート（${bay.span}）`, sheetsPerSpan);
        }
        if (s.tsumaSheetCount > 0) {
          // 妻側は枠幅サイズのシートを流用（sub-alba 準拠で枠幅ごとに算出）
          const key = `妻側メッシュシート（${run.width}）`;
          if (WEIGHT_DICT[key] !== undefined) add(key, s.tsumaSheetCount * sheetsPerSpan);
        }
      }
    }
  }

  // --- 行の整形 ---
  const rows: BomRow[] = orderedKeys()
    .filter((key) => (q.get(key) ?? 0) > 0)
    .map((key) => {
      const quantity = Math.round(q.get(key)!);
      const unitWeightKg = WEIGHT_DICT[key] ?? 0;
      return {
        name: key,
        spec: SPEC_MAP[key] ?? '-',
        quantity,
        unitWeightKg,
        totalWeightKg: Math.round(quantity * unitWeightKg * 100) / 100,
      };
    });

  const totalWeightKg = Math.round(rows.reduce((sum, r) => sum + r.totalWeightKg, 0) * 100) / 100;

  // --- 検証 ---
  const pillarHeightManual = s.pillarOverride
    ? Object.entries(s.pillarOverride).reduce((sum, [len, n]) => sum + Number(len) * n, 0)
    : heightMm;
  const jackBaseProvided =
    s.jackBaseOption === 'custom' ? s.sb20Count + s.sb40Count : jackBaseNeeded + stairExtraNodes;
  const validation: BomValidation = {
    pillarStatus: !s.pillarOverride ? 'auto' : pillarHeightManual === heightMm ? 'ok' : 'mismatch',
    pillarHeightMm: pillarHeightManual,
    jackBaseStatus:
      s.jackBaseMode === 'none' || s.jackBaseOption !== 'custom'
        ? 'ok'
        : jackBaseProvided < jackBaseNeeded + stairExtraNodes
          ? 'under'
          : jackBaseProvided > jackBaseNeeded + stairExtraNodes
            ? 'over'
            : 'ok',
    jackBaseNeeded: jackBaseNeeded + stairExtraNodes,
    jackBaseProvided,
    openingOverLimit,
  };

  // --- 輸送提案（sub-alba 準拠） ---
  const w = totalWeightKg;
  const transportUnic =
    w === 0 ? '-' :
    w <= 2000 ? '4tユニック' :
    w <= 4500 ? '4t増ユニック 又は 6tユニック' :
    w <= 6500 ? '6tユニック' :
    w <= 12000 ? '12tユニック' :
    '超過（車両分割が必要）';
  const transportFlatbed =
    w === 0 ? '-' :
    w <= 4000 ? '4t平車' :
    w <= 6600 ? '6t平車' :
    w <= 12000 ? '12t平車' :
    '超過（車両分割が必要）';

  // 車両分割オプション（sub-alba 準拠）
  let splitOptions: string[] = [];
  if (w > 0) {
    const caps = { '4tＵ': 2000, '6tＵ': 6500, '12tＵ': 12000 };
    for (let t1 = 0; t1 <= 5; t1++) {
      for (let t2 = 0; t2 <= 4; t2++) {
        for (let t3 = 0; t3 <= 4; t3++) {
          if (t1 + t2 + t3 === 0) continue;
          const cap = t1 * caps['4tＵ'] + t2 * caps['6tＵ'] + t3 * caps['12tＵ'];
          if (cap >= w && cap <= w * 1.5 && cap <= 48000) {
            const parts = [];
            if (t1 > 0) parts.push(`4tＵ×${t1}`);
            if (t2 > 0) parts.push(`6tＵ×${t2}`);
            if (t3 > 0) parts.push(`12tＵ×${t3}`);
            splitOptions.push(parts.join(' + '));
          }
        }
      }
    }
    splitOptions.sort((a, b) => a.length - b.length);
    if (splitOptions.length === 1 && !splitOptions[0].includes('+') && /×1$/.test(splitOptions[0])) {
      splitOptions = [];
    }
    splitOptions = splitOptions.slice(0, 15);
  }

  return {
    rows,
    totalWeightKg,
    totalLengthMm,
    totalHeightMm: heightMm,
    bayCount,
    stairCount: stairSetCount,
    openingCount,
    cornerCount,
    nodeCount,
    pillarText: pillarComboText(pillarCombo),
    transportUnic,
    transportFlatbed,
    splitOptions,
    validation,
  };
}
