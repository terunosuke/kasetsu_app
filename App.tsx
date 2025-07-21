import React, { useState, useMemo, useCallback } from 'react';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import { InputForm } from './components/InputForm';
import { ConfirmationTab } from './components/ConfirmationTab';
import { ResultsTab } from './components/ResultsTab';
import type { ScaffoldingConfig, CustomHeight } from './types';
import { useScaffoldingCalculator } from './hooks/useScaffoldingCalculator';
import 'react-tabs/style/react-tabs.css'; // default styling for tabs

const App: React.FC = () => {
    const [activeTab, setActiveTab] = useState(0);

    const [config, setConfig] = useState<ScaffoldingConfig>({
        span600: 0,
        span900: 0,
        span1200: 0,
        span1500: 0,
        span1800: 0,
        faceCount: 1,
        faceWidth: 900,
        levelCount: 3,
        heightMode: 'all1800',
        customHeights: [{ height: 1800, count: 3 }],
        pillarSelection: { 450: 0, 900: 0, 1800: 0, 2700: 0, 3600: 0 },
        isBottom: true,
        jackBaseOption: 'allSB20',
        sb20Count: 0,
        sb40Count: 0,
        taiko40: 0,
        taiko80: 0,
        antiMode: 'all',
        antiLevels: '1,2,3',
        toeboardMode: 'sameAsAnti',
        toeboardLevels: '',
        tsumaCount: 2,
        stairMode: 'notTop',
        stairLevels: '',
        memo: '',
    });

    const setConfigField = useCallback(<K extends keyof ScaffoldingConfig>(field: K, value: ScaffoldingConfig[K]) => {
        setConfig(prev => ({ ...prev, [field]: value }));
    }, []);

    const setCustomHeights = useCallback((heights: CustomHeight[]) => {
        setConfig(prev => ({ ...prev, customHeights: heights }));
    }, []);

    const setPillarSelection = useCallback((length: number, count: number) => {
        setConfig(prev => ({
            ...prev,
            pillarSelection: {
                ...prev.pillarSelection,
                [length]: count,
            }
        }));
    }, []);

    const { results, validation } = useScaffoldingCalculator(config);

    const renderTabPanel = (index: number, Component: React.ElementType) => {
        return (
            <TabPanel key={index}>
                <div className="p-4 md:p-8 bg-white rounded-b-lg rounded-r-lg shadow-lg">
                    <Component 
                        config={config} 
                        setConfigField={setConfigField} 
                        setCustomHeights={setCustomHeights} 
                        setPillarSelection={setPillarSelection} 
                        results={results} 
                        validation={validation} 
                    />
                </div>
            </TabPanel>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
            <header className="bg-white shadow-md">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center space-x-4">
                        <div className="text-4xl">🛠️</div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">仮設足場拾い出しツール</h1>
                            <p className="text-sm text-slate-500">Scaffolding Material Estimator</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto p-4 sm:p-6 lg:p-8">
                <style>{`
                    .react-tabs__tab {
                        padding: 12px 24px;
                        border-radius: 8px 8px 0 0;
                        font-weight: 600;
                        color: #475569;
                        background: #f1f5f9;
                        border: 1px solid #e2e8f0;
                        border-bottom: none;
                        transition: all 0.2s ease-in-out;
                    }
                    .react-tabs__tab--selected {
                        background: #ffffff;
                        color: #0284c7;
                        border-color: #e2e8f0;
                        border-bottom: 1px solid white;
                        top: 1px;
                        position: relative;
                    }
                    .react-tabs__tab:focus {
                        outline: none;
                        box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.5);
                    }
                    .react-tabs__tab-list {
                        border-bottom: 1px solid #e2e8f0;
                        margin: 0;
                    }
                `}</style>

                <Tabs selectedIndex={activeTab} onSelect={index => setActiveTab(index)}>
                    <TabList>
                        <Tab>📥 入力項目</Tab>
                        <Tab>✅ 入力条件の確認</Tab>
                        <Tab>📊 拾い出し結果</Tab>
                    </TabList>

                    {renderTabPanel(0, InputForm)}
                    {renderTabPanel(1, ConfirmationTab)}
                    {renderTabPanel(2, ResultsTab)}
                </Tabs>
            </main>

            <footer className="text-center py-6 text-sm text-slate-500">
                <p>&copy; {new Date().getFullYear()} Modern Scaffolding Solutions. All Rights Reserved.</p>
            </footer>
        </div>
    );
};

export default App;
