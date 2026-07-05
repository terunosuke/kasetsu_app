import type { Bom } from './bom';

/** BOM を CSV 文字列に変換する（Excel 互換のため BOM 付き UTF-8 を想定） */
export function bomToCsv(bom: Bom): string {
  const lines: string[] = [];
  lines.push('規格,部材名,数量,単重(kg),重量(kg)');
  for (const row of bom.rows) {
    lines.push(`${row.spec},${row.name},${row.quantity},${row.unitWeightKg},${row.totalWeightKg}`);
  }
  lines.push(`,合計,,,${bom.totalWeightKg}`);
  return lines.join('\n');
}

/** ブラウザ上で CSV をダウンロードさせる */
export function downloadCsv(bom: Bom, filename = '足場拾い出し.csv'): void {
  const csv = '\uFEFF' + bomToCsv(bom);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
