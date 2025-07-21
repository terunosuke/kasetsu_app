
import React from 'react';
import type { ScaffoldingConfig, CustomHeight, ValidationResults } from '../types';
import { Card } from './Card';
import { InputGroup } from './InputGroup';
import { Alert } from './Alert';

interface InputFormProps {
    config: ScaffoldingConfig;
    setConfigField: <K extends keyof ScaffoldingConfig>(field: K, value: ScaffoldingConfig[K]) => void;
    setCustomHeights: (heights: CustomHeight[]) => void;
    setPillarSelection: (length: number, count: number) => void;
    validation: ValidationResults;
}

export const InputForm: React.FC<InputFormProps> = ({ config, setConfigField, setCustomHeights, setPillarSelection, validation }) => {
    
    const handleCustomHeightChange = (index: number, field: keyof CustomHeight, value: number) => {
        const newHeights = [...config.customHeights];
        newHeights[index] = { ...newHeights[index], [field]: value };
        setCustomHeights(newHeights);
    };

    const addCustomHeightRow = () => {
        setCustomHeights([...config.customHeights, { height: 1800, count: 1 }]);
    };

    const removeCustomHeightRow = (index: number) => {
        setCustomHeights(config.customHeights.filter((_, i) => i !== index));
    };
    
    const totalHeight = config.heightMode === 'all1800' ? config.levelCount * 1800 : config.customHeights.reduce((sum, item) => sum + (item.height * item.count), 0);

    return (
        <div className="space-y-6">
            <Card title="大枠の設定" defaultOpen>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
                    {/* Span Direction */}
                    <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                        <h4 className="font-semibold text-slate-700">◎ スパン方向（長手）</h4>
                        <InputGroup label="600mmスパン数" type="number" value={config.span600} onChange={e => setConfigField('span600', parseInt(e.target.value) || 0)} min={0} />
                        <InputGroup label="900mmスパン数" type="number" value={config.span900} onChange={e => setConfigField('span900', parseInt(e.target.value) || 0)} min={0} />
                        <InputGroup label="1200mmスパン数" type="number" value={config.span1200} onChange={e => setConfigField('span1200', parseInt(e.target.value) || 0)} min={0} />
                        <InputGroup label="1500mmスパン数" type="number" value={config.span1500} onChange={e => setConfigField('span1500', parseInt(e.target.value) || 0)} min={0} />
                        <InputGroup label="1800mmスパン数" type="number" value={config.span1800} onChange={e => setConfigField('span1800', parseInt(e.target.value) || 0)} min={0} />
                    </div>
                     {/* Frame Direction */}
                    <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                        <h4 className="font-semibold text-slate-700">◎ 枠方向（短手）</h4>
                        <InputGroup label="列数" type="number" value={config.faceCount} onChange={e => setConfigField('faceCount', parseInt(e.target.value) || 1)} min={1} />
                        <InputGroup label="枠方向のサイズ(mm)" as="select" value={config.faceWidth} onChange={e => setConfigField('faceWidth', parseInt(e.target.value))}>
                            <option value={450}>450</option>
                            <option value={600}>600</option>
                            <option value={900}>900</option>
                            <option value={1200}>1200</option>
                        </InputGroup>
                    </div>
                     {/* Height Direction */}
                    <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                        <h4 className="font-semibold text-slate-700">◎ 高さ方向</h4>
                        <InputGroup label="段数" type="number" value={config.levelCount} onChange={e => setConfigField('levelCount', parseInt(e.target.value) || 1)} min={1} />
                        <InputGroup label="各段の高さ" as="select" value={config.heightMode} onChange={e => setConfigField('heightMode', e.target.value as 'all1800' | 'custom')}>
                            <option value="all1800">全段1800mm</option>
                            <option value="custom">一部を指定する</option>
                        </InputGroup>
                        {config.heightMode === 'custom' && (
                            <div className="space-y-2 pt-2 border-t mt-2">
                                {config.customHeights.map((row, index) => (
                                    <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                                        <InputGroup label={`高さ`} hideLabel as="select" value={row.height} onChange={e => handleCustomHeightChange(index, 'height', parseInt(e.target.value))}>
                                            <option value={1800}>1800</option>
                                            <option value={1350}>1350</option>
                                            <option value={900}>900</option>
                                            <option value={450}>450</option>
                                        </InputGroup>
                                        <InputGroup label={`段数`} hideLabel type="number" value={row.count} min={1} onChange={e => handleCustomHeightChange(index, 'count', parseInt(e.target.value) || 1)} />
                                        {config.customHeights.length > 1 && <button onClick={() => removeCustomHeightRow(index)} className="text-red-500 hover:text-red-700 font-bold">✖️</button>}
                                    </div>
                                ))}
                                <button onClick={addCustomHeightRow} className="text-sm text-primary hover:text-primary-hover font-semibold mt-2">+ 行を追加</button>
                                {validation.customHeightStatus === 'under' && <Alert type="warning" message={`現在 ${config.levelCount - validation.remainingLevels} 段 指定済（残り ${validation.remainingLevels} 段）`} />}
                                {validation.customHeightStatus === 'over' && <Alert type="error" message={`段数が超過しています！`} />}
                                {validation.customHeightStatus === 'ok' && <Alert type="success" message="指定段数が一致しました" />}
                            </div>
                        )}
                        <div className="pt-2 text-sm font-medium text-slate-600">足場の総高さ: H {totalHeight} mm</div>
                    </div>
                </div>
            </Card>

            <Card title="個別部材の設定">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
                    {/* Pillar Config */}
                    <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                        <h4 className="font-semibold text-slate-700">◎ 支柱の構成</h4>
                        <p className="text-xs text-slate-500">
                            1本の支柱を構成する各サイズのパーツの本数を入力してください。
                            合計高さが「高さ方向」で設定した総高さと一致するようにします。
                        </p>
                        {[450, 900, 1800, 2700, 3600].map(len => (
                            <InputGroup key={len} label={`支柱${len}mm の本数`} type="number" min={0} value={config.pillarSelection[len]} onChange={e => setPillarSelection(len, parseInt(e.target.value) || 0)} />
                        ))}
                        <div className="pt-2 border-t mt-2">
                            <div className="text-sm font-medium text-slate-600 mb-2">
                                支柱構成の合計高さ: H {validation.totalPillarAssemblyHeight} mm
                            </div>
                            {validation.pillarHeightStatus === 'ok' && totalHeight > 0 && validation.totalPillarAssemblyHeight > 0 && (
                                <Alert type="success" message="支柱構成と足場高さが一致しています" />
                            )}
                            {validation.pillarHeightStatus === 'error' && totalHeight > 0 && validation.totalPillarAssemblyHeight > 0 && (
                                <Alert type="error" message={`足場総高さ(${totalHeight}mm)と一致しません`} />
                            )}
                        </div>
                    </div>
                    {/* Jack Base */}
                    <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                        <h4 className="font-semibold text-slate-700">◎ ジャッキベース</h4>
                        <InputGroup label="最下段である（ジャッキベース必要）" as="checkbox" checked={config.isBottom} onChange={e => setConfigField('isBottom', e.target.checked)} />
                        {config.isBottom && (
                             <>
                                <InputGroup label="ジャッキベースの種類" as="select" value={config.jackBaseOption} onChange={e => setConfigField('jackBaseOption', e.target.value as 'allSB20' | 'allSB40' | 'custom')}>
                                    <option value="allSB20">全てSB20（H58-H230）</option>
                                    <option value="allSB40">全てSB40（H58-H350）</option>
                                    <option value="custom">個別指定</option>
                                </InputGroup>
                                {config.jackBaseOption === 'custom' && (
                                    <div className="space-y-2">
                                        <InputGroup label="SB20の本数" type="number" min={0} value={config.sb20Count} onChange={e => setConfigField('sb20Count', parseInt(e.target.value) || 0)} />
                                        <InputGroup label="SB40の本数" type="number" min={0} value={config.sb40Count} onChange={e => setConfigField('sb40Count', parseInt(e.target.value) || 0)} />
                                        {validation.jackBaseStatus === 'under' && <Alert type="warning" message={`不足しています (必要: ${validation.jackBaseNeeded} / 指定: ${validation.jackBaseProvided})`} />}
                                        {validation.jackBaseStatus === 'over' && <Alert type="error" message={`超過しています (必要: ${validation.jackBaseNeeded} / 指定: ${validation.jackBaseProvided})`} />}
                                        {validation.jackBaseStatus === 'ok' && <Alert type="success" message="本数が一致しています" />}
                                    </div>
                                )}
                             </>
                        )}
                    </div>
                     {/* Other */}
                    <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                        <h4 className="font-semibold text-slate-700">◎ その他</h4>
                        <InputGroup label="アンチ設置段" as="select" value={config.antiMode} onChange={e => setConfigField('antiMode', e.target.value as 'all' | 'notBottom' | 'custom')}>
                            <option value="all">全段</option>
                            <option value="notBottom">最下段以外</option>
                            <option value="custom">指定段</option>
                        </InputGroup>
                         {config.antiMode === 'custom' && <InputGroup label="段番号 (カンマ区切り)" placeholder="例: 1,3,5" value={config.antiLevels} onChange={e => setConfigField('antiLevels', e.target.value)} />}

                        <InputGroup label="巾木設置段" as="select" value={config.toeboardMode} onChange={e => setConfigField('toeboardMode', e.target.value as 'all' | 'sameAsAnti' | 'custom')}>
                            <option value="all">全段</option>
                            <option value="sameAsAnti">アンチと同じ段</option>
                            <option value="custom">指定段</option>
                        </InputGroup>
                        {config.toeboardMode === 'custom' && <InputGroup label="段番号 (カンマ区切り)" placeholder="例: 1,3,5" value={config.toeboardLevels} onChange={e => setConfigField('toeboardLevels', e.target.value)} />}
                        
                        <InputGroup label="妻側手すり" as="select" value={config.tsumaCount} onChange={e => setConfigField('tsumaCount', parseInt(e.target.value) as 0|1|2)}>
                             <option value={2}>両側必要（新規足場）→2面</option>
                             <option value={1}>片側のみ→1面</option>
                             <option value={0}>不要→0面</option>
                        </InputGroup>

                        <InputGroup label="階段設置" as="select" value={config.stairMode} onChange={e => setConfigField('stairMode', e.target.value as 'none' | 'notTop' | 'custom')}>
                            <option value="none">設置しない</option>
                            <option value="notTop">最上段以外</option>
                            <option value="custom">指定段のみ</option>
                        </InputGroup>
                        {config.stairMode === 'custom' && <InputGroup label="段番号 (カンマ区切り)" placeholder="例: 1,2,4" value={config.stairLevels} onChange={e => setConfigField('stairLevels', e.target.value)} />}

                        <InputGroup label="タイコ40" type="number" min={0} value={config.taiko40} onChange={e => setConfigField('taiko40', parseInt(e.target.value) || 0)} />
                        <InputGroup label="タイコ80" type="number" min={0} value={config.taiko80} onChange={e => setConfigField('taiko80', parseInt(e.target.value) || 0)} />
                    </div>
                </div>
            </Card>

            <Card title="📝 フリーメモ">
                <div className="p-4">
                    <textarea
                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition duration-150 ease-in-out"
                        rows={4}
                        placeholder="現場名、日付、担当者、部位など自由記入"
                        value={config.memo}
                        onChange={e => setConfigField('memo', e.target.value)}
                    />
                </div>
            </Card>
        </div>
    );
};