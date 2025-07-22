
import React from 'react';

interface SummaryCardProps {
    title: string;
    value: string;
    icon: string;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, icon }) => {
    return (
        <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200 flex items-center space-x-4">
            <div className="text-4xl">{icon}</div>
            <div>
                <p className="text-sm font-medium text-slate-500">{title}</p>
                <p className="text-lg font-bold text-slate-900">{value}</p>
            </div>
        </div>
    );
};
