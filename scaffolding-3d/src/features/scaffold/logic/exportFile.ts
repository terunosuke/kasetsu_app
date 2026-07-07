/**
 * 拾い出し結果のファイル出力（sub-alba の出力書式に準拠）。
 *   CSV:   部材名, 数量, 単位重量(kg), 合計重量(kg) ＋ 総重量行 ＋ フリーメモ
 *   Excel: 規格コード / 数量 / 備考 の3列（発注取込み用フォーマット）
 */
import * as XLSX from 'xlsx';
import type { Bom } from './bom';

function today(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '').substring(2);
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function bomToCsv(bom: Bom, memo: string): string {
  const lines: string[] = [];
  lines.push('部材名,数量,単位重量（kg）,合計重量（kg）');
  for (const row of bom.rows) {
    lines.push(
      `"${row.name}",${row.quantity},${row.unitWeightKg.toFixed(2)},${row.totalWeightKg.toFixed(2)}`,
    );
  }
  lines.push(`"🟦 総重量",,,${bom.totalWeightKg.toFixed(2)}`);
  if (memo) {
    lines.push('');
    lines.push('"📝フリーメモ",,,');
    lines.push(`"${memo.replace(/"/g, '""')}",,,`);
  }
  return lines.join('\n');
}

/** CSV ダウンロード（Excel 互換の BOM 付き UTF-8） */
export function downloadCsv(bom: Bom, memo: string): void {
  const csv = '\uFEFF' + bomToCsv(bom, memo);
  download(
    new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    `${today()}_アルバトロス数量.csv`,
  );
}

/** Excel（発注書式: 規格コード10桁・数量5桁・備考20桁）ダウンロード */
export function downloadExcel(bom: Bom): void {
  const wsData: (string | number)[][] = [
    ['規格コード\n１０桁（必須）', '数量\n５桁（必須）', '備考\n２０桁'],
    ...bom.rows.map((row) => [row.spec === '-' ? '' : row.spec, row.quantity, '']),
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 14 }, { wch: 8 }, { wch: 26 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '拾い出し結果');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  download(
    new Blob([out], { type: 'application/octet-stream' }),
    `${today()}_アルバトロス数量.xlsx`,
  );
}
