
import React from 'react';
import type { MaterialItem } from '../types';

interface ResultTableProps {
    materials: MaterialItem[];
    totalWeight: number;
}

export const ResultTable: React.FC<ResultTableProps> = ({ materials, totalWeight }) => {
    return (
        <div className="overflow-x-auto">
            <div className="align-middle inline-block min-w-full">
                <div className="shadow overflow-hidden border-b border-slate-200 sm:rounded-lg">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-100">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                                    部材名
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">
                                    数量
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">
                                    単位重量 (kg)
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">
                                    合計重量 (kg)
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {materials.map((item, index) => (
                                <tr key={index} className="hover:bg-slate-50 transition-colors duration-150">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{item.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 text-right">{item.quantity}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 text-right">{item.unitWeight.toFixed(2)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 text-right font-semibold">{item.totalWeight.toFixed(2)}</td>
                                </tr>
                            ))}
                            <tr className="bg-primary-light">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-primary">🟦 総重量</td>
                                <td colSpan={2}></td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-primary font-bold text-right">{totalWeight.toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
