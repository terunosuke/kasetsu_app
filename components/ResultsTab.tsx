
import React, { useState } from 'react';
import type { ScaffoldingConfig, CalculationResults, MaterialItem } from '../types';
import { ResultTable } from './ResultTable';
import { SummaryCard } from './SummaryCard';

interface ResultsTabProps {
    config: ScaffoldingConfig;
    results: CalculationResults;
}

export const ResultsTab: React.FC<ResultsTabProps> = ({ config, results }) => {
    const [useSplit, setUseSplit] = useState(false);
    const [selectedSplit, setSelectedSplit] = useState<string>(results.splitOptions[0] || '');

    const downloadCSV = () => {
        const headers = ["部材名", "数量", "単位重量（kg）", "合計重量（kg）"];
        
        let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n";
        
        const materialsWithTotal = [...results.materials];
        materialsWithTotal.push({ name: '🟦 総重量', quantity: 0, unitWeight: 0, totalWeight: results.totalWeight });

        materialsWithTotal.forEach((item: MaterialItem) => {
            const row = [
                `"${item.name}"`,
                item.name === '🟦 総重量' ? '' : item.quantity,
                item.name === '🟦 総重量' ? '' : item.unitWeight.toFixed(2),
                item.totalWeight.toFixed(2)
            ].join(",");
            csvContent += row + "\n";
        });
        
        if (config.memo) {
            csvContent += "\n";
            csvContent += '"📝フリーメモ",,,\n';
            csvContent += `"${config.memo.replace(/"/g, '""')}",,,\n`;
        }

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '').substring(2);
        link.setAttribute("download", `${today}_仮設足場_拾い出し結果.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div>
            <h2 className="text-2xl font-bold text-slate-800 mb-6">📊 拾い出し結果</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <SummaryCard title="総重量" value={`${results.totalWeight.toFixed(2)} kg`} icon="⚖️" />
                <SummaryCard title="ユニック車" value={results.transportUnic} icon="🏗️" />
                <SummaryCard title="平車" value={results.transportFlatbed} icon="🚛" />
            </div>
            
            <div className="bg-slate-50 p-4 rounded-lg mb-8 border border-slate-200">
                <div className="flex items-center">
                    <input
                        type="checkbox"
                        id="split-transport"
                        checked={useSplit}
                        onChange={(e) => setUseSplit(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <label htmlFor="split-transport" className="ml-3 block text-sm font-medium text-slate-700">
                        🧮 車両を分割して運搬する（敷地条件等を考慮）
                    </label>
                </div>

                {useSplit && (
                    <div className="mt-4">
                        {results.splitOptions.length > 0 ? (
                            <div className="flex items-center gap-4">
                               <select 
                                    value={selectedSplit}
                                    onChange={(e) => setSelectedSplit(e.target.value)}
                                    className="block w-full max-w-xs pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
                               >
                                    {results.splitOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                               </select>
                                <div className="p-2 bg-green-100 text-green-800 text-sm font-semibold rounded-md">
                                     ✅ 選択中の分割案: <strong>{selectedSplit}</strong>
                                </div>
                            </div>
                        ) : (
                            <div className="text-red-600 text-sm font-semibold p-2 bg-red-100 rounded-md">
                                ⚠️ 総重量が大きいです。積載重量表を参考に車両選択をしてください。
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-slate-800">💻 部材リスト</h3>
                <button
                    onClick={downloadCSV}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                >
                    📥 CSVでダウンロード
                </button>
            </div>
            
            <ResultTable materials={results.materials} totalWeight={results.totalWeight} />
            
            {config.memo && (
                <div className="mt-8">
                    <h3 className="text-xl font-bold text-slate-800 mb-2">📝 フリーメモ</h3>
                    <div className="p-4 bg-primary-light border-l-4 border-primary text-slate-700 rounded-r-lg">
                        <p className="whitespace-pre-wrap">{config.memo}</p>
                    </div>
                </div>
            )}
        </div>
    );
};
