
import { useMemo } from 'react';
import type { ScaffoldingConfig, CalculationResults, ValidationResults, MaterialItem } from '../types';
import { WEIGHT_DICT } from '../constants';

const parseLevels = (levelsStr: string): number[] => {
    if (!levelsStr) return [];
    return levelsStr.split(',').map(x => parseInt(x.trim(), 10)).filter(x => !isNaN(x));
};

export const useScaffoldingCalculator = (config: ScaffoldingConfig): { results: CalculationResults, validation: ValidationResults } => {
    return useMemo(() => {
        // --- Basic Calculations ---
        const spanTotal = config.span600 + config.span900 + config.span1200 + config.span1500 + config.span1800;
        const totalHeight = config.heightMode === 'all1800'
            ? config.levelCount * 1800
            : config.customHeights.reduce((sum, item) => sum + (item.height * item.count), 0);
        
        const jackBaseCount = config.isBottom ? (spanTotal + 1) * (config.faceCount + 1) : 0;

        // --- Pillar Assembly Height Calculation & Validation ---
        const totalPillarAssemblyHeight = Object.entries(config.pillarSelection).reduce(
            (sum, [length, count]) => sum + (parseInt(length) * count),
            0
        );
        const pillarHeightStatus = totalPillarAssemblyHeight === totalHeight ? 'ok' : 'error';
        
        // --- Validation Logic ---
        const totalCustomLevels = config.customHeights.reduce((sum, item) => sum + item.count, 0);
        const customHeightStatus = totalCustomLevels < config.levelCount ? 'under' : totalCustomLevels > config.levelCount ? 'over' : 'ok';
        
        const jackBaseProvided = config.sb20Count + config.sb40Count;
        const jackBaseStatus = config.jackBaseOption === 'custom' 
            ? (jackBaseProvided < jackBaseCount ? 'under' : jackBaseProvided > jackBaseCount ? 'over' : 'ok') 
            : 'ok';
            
        const pillarSummary = Object.entries(config.pillarSelection)
            .filter(([, count]) => count > 0)
            .map(([length, count]) => `${length}mm×${count}本`);
        const pillarText = pillarSummary.length > 0 ? pillarSummary.join('、') : "なし";

        const validation: ValidationResults = {
            customHeightStatus,
            remainingLevels: config.levelCount - totalCustomLevels,
            jackBaseStatus,
            jackBaseNeeded: jackBaseCount,
            jackBaseProvided,
            pillarHeightStatus,
            totalPillarAssemblyHeight,
        };

        // --- Material Calculation ---
        const coefsCombined: { [key: string]: number } = {};
        
        const spanLengths: { [key: number]: number } = {
            600: config.span600, 900: config.span900, 1200: config.span1200, 1500: config.span1500, 1800: config.span1800
        };

        let antiLevelsResolved: number[];
        if (config.antiMode === 'all') antiLevelsResolved = Array.from({ length: config.levelCount }, (_, i) => i + 1);
        else if (config.antiMode === 'notBottom') antiLevelsResolved = Array.from({ length: Math.max(0, config.levelCount - 1) }, (_, i) => i + 2);
        else antiLevelsResolved = parseLevels(config.antiLevels);

        let toeboardLevelsResolved: number[];
        if (config.toeboardMode === 'all') toeboardLevelsResolved = Array.from({ length: config.levelCount }, (_, i) => i + 1);
        else if (config.toeboardMode === 'sameAsAnti') toeboardLevelsResolved = antiLevelsResolved;
        else toeboardLevelsResolved = parseLevels(config.toeboardLevels);

        let stairLevelsResolved: number[];
        if (config.stairMode === 'none') stairLevelsResolved = [];
        else if (config.stairMode === 'notTop') stairLevelsResolved = Array.from({ length: Math.max(0, config.levelCount - 1) }, (_, i) => i + 1);
        else stairLevelsResolved = parseLevels(config.stairLevels);


        const anti_items: { [key: string]: number } = {};
        const toeboard_items: { [key: string]: number } = {};
        const handrail_items: { [key: string]: number } = {};
        const brace_items: { [key: string]: number } = {};

        for (const [length, count] of Object.entries(spanLengths)) {
            if (count === 0) continue;
            const len = parseInt(length);
            const numItems = count * config.faceCount * antiLevelsResolved.length;

            // アンチ
            if (config.faceWidth === 450) {
                anti_items[`アンチ${len}/40`] = (anti_items[`アンチ${len}/40`] || 0) + numItems;
            } else if (config.faceWidth === 600) {
                anti_items[`アンチ${len}/50`] = (anti_items[`アンチ${len}/50`] || 0) + numItems;
            } else if (config.faceWidth === 900) {
                // FIX: Use 500mm + 400mm panels to fill 900mm width
                anti_items[`アンチ${len}/50`] = (anti_items[`アンチ${len}/50`] || 0) + numItems;
                anti_items[`アンチ${len}/40`] = (anti_items[`アンチ${len}/40`] || 0) + numItems;
            } else if (config.faceWidth === 1200) {
                // FIX: Use 3 x 400mm panels to fill 1200mm width
                anti_items[`アンチ${len}/40`] = (anti_items[`アンチ${len}/40`] || 0) + numItems * 3;
            }

            // 巾木 (長手方向、両側)
            toeboard_items[`巾木${len}`] = (toeboard_items[`巾木${len}`] || 0) + count * toeboardLevelsResolved.length * 2;
            // 手すり（長手方向、両側）
            handrail_items[`長手手すり${len}`] = (handrail_items[`長手手すり${len}`] || 0) + count * config.levelCount * 2;
            // ブレス (長手方向、両側) - Corrected to brace only outer faces
            brace_items[`ブレス${len}`] = (brace_items[`ブレス${len}`] || 0) + count * config.levelCount * 2;
        }

        const short_beam_count = (spanTotal + 1) * config.levelCount * config.faceCount;
        const floor_plate_count = jackBaseCount;
        const stair_count = config.faceCount * stairLevelsResolved.length;
        const tsuma_handrail_count = config.levelCount * config.faceCount * config.tsumaCount * 2;
        const tsuma_toeboard_count = toeboardLevelsResolved.length * config.faceCount * config.tsumaCount;

        const brace_keys = Object.keys(brace_items).sort();
        const handrail_keys = Object.keys(handrail_items).sort();
        const tsuma_key = `妻側手すり（${config.faceWidth}mm）`;
        const tsuma_toeboard_key = `妻側巾木（${config.faceWidth}mm）`;
        const short_beam_key = `短手布材（${config.faceWidth}mm）※アンチをかける布材`;
        const anti_keys = Object.keys(anti_items).sort();
        const toeboard_keys = Object.keys(toeboard_items).sort();
        const pillar_keys = Object.keys(config.pillarSelection)
          .filter(length => config.pillarSelection[parseInt(length)] > 0)
          .map(length => `支柱（${length}mm）`);
          
        const ordered_keys = [
            "敷板", "ジャッキベースSB20", "ジャッキベースSB40", "タイコ40", "タイコ80",
            ...pillar_keys, ...brace_keys, ...handrail_keys,
            ...(tsuma_handrail_count > 0 ? [tsuma_key] : []),
            ...(tsuma_toeboard_count > 0 ? [tsuma_toeboard_key] : []),
            short_beam_key, ...anti_keys, ...toeboard_keys, "階段"
        ];

        if (floor_plate_count > 0) coefsCombined["敷板"] = floor_plate_count;
        if (config.isBottom) {
            if (config.jackBaseOption === 'allSB20') coefsCombined["ジャッキベースSB20"] = jackBaseCount;
            else if (config.jackBaseOption === 'allSB40') coefsCombined["ジャッキベースSB40"] = jackBaseCount;
            else if (config.jackBaseOption === 'custom') {
                if (config.sb20Count > 0) coefsCombined["ジャッキベースSB20"] = config.sb20Count;
                if (config.sb40Count > 0) coefsCombined["ジャッキベースSB40"] = config.sb40Count;
            }
        }
        if (config.taiko40 > 0) coefsCombined["タイコ40"] = config.taiko40;
        if (config.taiko80 > 0) coefsCombined["タイコ80"] = config.taiko80;
        if (stair_count > 0) coefsCombined["階段"] = stair_count;
        
        const numLegs = (spanTotal + 1) * (config.faceCount + 1);
        Object.entries(config.pillarSelection).forEach(([length, count]) => {
            if (count > 0) {
                 const key = `支柱（${length}mm）`;
                 coefsCombined[key] = count * numLegs;
            }
        });
        
        Object.assign(coefsCombined, brace_items, handrail_items, anti_items, toeboard_items);
        if (tsuma_handrail_count > 0) coefsCombined[tsuma_key] = tsuma_handrail_count;
        if (tsuma_toeboard_count > 0) coefsCombined[tsuma_toeboard_key] = tsuma_toeboard_count;
        coefsCombined[short_beam_key] = short_beam_count;

        const final_materials: MaterialItem[] = ordered_keys
            .filter(key => coefsCombined[key] > 0 && coefsCombined[key] !== undefined)
            .map(key => {
                const quantity = Math.round(coefsCombined[key]);
                const unitWeight = WEIGHT_DICT[key] || 0;
                return {
                    name: key,
                    quantity,
                    unitWeight,
                    totalWeight: parseFloat((quantity * unitWeight).toFixed(2))
                };
            });
        
        const totalWeight = parseFloat(final_materials.reduce((sum, item) => sum + item.totalWeight, 0).toFixed(2));

        const W = totalWeight;
        const transportUnic =
            W <= 2050 ? "✅ 4tユニック" :
            W <= 6400 ? "✅ 6tユニック" :
            W <= 12000 ? "✅ 12tユニック" :
            "⚠️ 超過（12tユニックでは積載不可）";
        
        const transportFlatbed =
            W <= 4000 ? "✅ 4t平車" :
            W <= 6600 ? "✅ 6t平車" :
            W <= 12000 ? "✅ 12t平車" :
            "⚠️ 超過（12t平車では積載不可）";
            
        // --- Split vehicle options ---
        const splitOptions: string[] = [];
        const truck_caps = { "4t平車": 4000, "6t平車": 6600, "12t平車": 12000 };
        for (let t1 = 0; t1 <= 4; t1++) {
            for (let t2 = 0; t2 <= 3; t2++) {
                for (let t3 = 0; t3 <= 2; t3++) {
                    if (t1 + t2 + t3 === 0) continue;
                    const total_cap = t1 * truck_caps["4t平車"] + t2 * truck_caps["6t平車"] + t3 * truck_caps["12t平車"];
                    if (total_cap >= W && total_cap < W + 8000) {
                        const parts = [];
                        if (t1 > 0) parts.push(`4t平車×${t1}`);
                        if (t2 > 0) parts.push(`6t平車×${t2}`);
                        if (t3 > 0) parts.push(`12t平車×${t3}`);
                        if (parts.length > 0) {
                            splitOptions.push(parts.join(" + "));
                        }
                    }
                }
            }
        }
        splitOptions.sort((a, b) => a.length - b.length);

        const results: CalculationResults = {
            materials: final_materials,
            totalWeight,
            spanTotal,
            totalHeight,
            jackBaseCount,
            pillarText,
            transportUnic,
            transportFlatbed,
            splitOptions: splitOptions.slice(0, 15) // Limit options
        };

        return { results, validation };
    }, [config]);
};