import React, { useState, useRef } from 'react';
import { Card } from './Card';
import { Alert } from './Alert';

interface AIPdfExtractorProps {
    isAnalyzing: boolean;
    analysisError: string | null;
    analysisSuccess: string | null;
    onAnalyze: (file: File) => void;
}

export const AIPdfExtractor: React.FC<AIPdfExtractorProps> = ({ isAnalyzing, analysisError, analysisSuccess, onAnalyze }) => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        setSelectedFile(file);
    };
    
    const handleSelectClick = () => {
        fileInputRef.current?.click();
    };

    const handleAnalyzeClick = () => {
        if (selectedFile) {
            onAnalyze(selectedFile);
        }
    };

    return (
        <Card title="🤖 図面から自動入力 (AI)" defaultOpen>
            <div className="p-4 space-y-4">
                <p className="text-sm text-slate-600">
                    PDF形式の足場図面をアップロードすると、AIがスパン数や段数などの基本情報を自動で読み取り、以下の項目に入力します。
                </p>
                
                <div className="flex items-center space-x-4 p-4 border-2 border-dashed border-slate-300 rounded-lg">
                    <input 
                        type="file" 
                        accept="application/pdf" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        className="hidden" 
                        aria-hidden="true"
                    />
                    <button 
                        onClick={handleSelectClick} 
                        type="button"
                        className="px-4 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50"
                        aria-label="PDFファイルを選択する"
                    >
                        ファイルを選択
                    </button>
                    <span className="text-sm text-slate-500 truncate" aria-live="polite">
                        {selectedFile ? selectedFile.name : 'ファイルが選択されていません'}
                    </span>
                </div>

                <button 
                    onClick={handleAnalyzeClick} 
                    disabled={!selectedFile || isAnalyzing}
                    type="button"
                    className="w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
                >
                    {isAnalyzing ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            解析中...
                        </>
                    ) : (
                        'AIで図面を解析'
                    )}
                </button>

                {analysisSuccess && <Alert type="success" message={analysisSuccess} />}
                {analysisError && <Alert type="error" message={analysisError} />}
            </div>
        </Card>
    );
};