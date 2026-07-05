/**
 * 配置（Run[]）＋全体設定 → 部材数量表（BOM）の導出。
 * 数量ルールは sub-alba の拾い出し計算に準拠（列数=1 の単列足場）:
 *   - ジャッキベース・支柱・根がらみ: 建地箇所数 = 節点数 × 2列
 *   - 長手手すり: スパン × 段数 × 2
 *   - ブレス:     スパン × 段数 × 1
 *   - 巾木:       スパン × 段数 × 2（両面）
 *   - アンチ:     スパン × 段数 × 枠幅ごとの敷き並べ構成
 *   - 短手布材:   節点数 × 段数
 *   - 妻側手すり: 列両端 × 段数 × 2段手すり
 *   - 妻側巾木:   列両端 × 段数 × 1
 *   - 敷板:       列全長を 4m/3m/2m で貪欲に割付 × 2列
 */
import { DECK_LAYOUT, SPEC_MAP, WEIGHT_DICT } from '../catalog/albatross';
import { pillarComboFor } from '../model/fitting';
import { LIFT_MM, SPANS, WIDTHS, runLength, type GlobalSettings, type Run } from '../model/types';

export interface BomRow {
  name: string;
  spec: string;
  quantity: number;
  unitWeightKg: number;
  totalWeightKg: number;
}

export interface Bom {
  rows: BomRow[];
  totalWeightKg: number;
  totalLengthMm: number;
  totalHeightMm: number;
  bayCount: number;
  transportUnic: string;
  transportFlatbed: string;
}

/** CSV・表の表示順（sub-alba の出力順に準拠） */
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
    ...pillarKeys,
    '根がらみ支柱',
    ...bySpan('ブレス'),
    ...bySpan('長手手すり'),
    ...byWidth('短手布材'),
    ...antiKeys,
    ...bySpan('巾木'),
    ...byWidth('妻側手すり'),
    ...byWidth('妻側巾木'),
  ];
}

export function computeBom(runs: Run[], s: GlobalSettings): Bom {
  const q = new Map<string, number>();
  const add = (key: string, n: number) => {
    if (n > 0) q.set(key, (q.get(key) ?? 0) + n);
  };

  const levels = s.levels;
  const totalHeightMm = levels * LIFT_MM;
  const pillarCombo = pillarComboFor(totalHeightMm);
  let totalLengthMm = 0;
  let bayCount = 0;

  for (const run of runs) {
    if (run.bays.length === 0) continue;
    const nodes = run.bays.length + 1;
    const legs = nodes * 2; // 内外2列分の建地
    bayCount += run.bays.length;

    add(`ジャッキベース（${s.jackBase === 'SB20' ? '20' : '40'}）`, legs);
    if (s.negarami) add('根がらみ支柱', legs);
    for (const [len, count] of Object.entries(pillarCombo)) {
      add(`支柱（${len}）`, count * legs);
    }

    for (const bay of run.bays) {
      add(`長手手すり（${bay.span}）`, levels * 2);
      add(`ブレス（${bay.span}）`, levels);
      if (s.toeboard) add(`巾木（${bay.span}）`, levels * 2);
      for (const deckType of DECK_LAYOUT[run.width]) {
        add(`アンチ（${deckType}/${bay.span}）`, levels);
      }
    }

    add(`短手布材（${run.width}）`, nodes * levels);

    if (s.tsuma) {
      add(`妻側手すり（${run.width}）`, 2 * levels * 2); // 両端 × 2段手すり
      const tsumaToeKey = `妻側巾木（${run.width}）`;
      if (WEIGHT_DICT[tsumaToeKey] !== undefined) add(tsumaToeKey, 2 * levels);
    }

    const len = runLength(run);
    totalLengthMm += len;

    if (s.basePlate) {
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
  }

  const rows: BomRow[] = orderedKeys()
    .filter((key) => (q.get(key) ?? 0) > 0)
    .map((key) => {
      const quantity = q.get(key)!;
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

  return { rows, totalWeightKg, totalLengthMm, totalHeightMm, bayCount, transportUnic, transportFlatbed };
}
