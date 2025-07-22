import { GoogleGenAI, Type } from "@google/genai";
import type { ScaffoldingConfig } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        span600: { type: Type.INTEGER, description: "Number of 600mm spans (600mmスパン数)." },
        span900: { type: Type.INTEGER, description: "Number of 900mm spans (900mmスパン数)." },
        span1200: { type: Type.INTEGER, description: "Number of 1200mm spans (1200mmスパン数)." },
        span1500: { type: Type.INTEGER, description: "Number of 1500mm spans (1500mmスパン数)." },
        span1800: { type: Type.INTEGER, description: "Number of 1800mm spans (1800mmスパン数)." },
        faceCount: { type: Type.INTEGER, description: "Number of faces (列数)." },
        faceWidth: { type: Type.INTEGER, description: "Width of the face frame in mm, e.g., 450, 600, 900, 1200 (枠方向のサイズ)." },
        levelCount: { type: Type.INTEGER, description: "Number of vertical levels (段数)." },
    },
    required: ["span600", "span900", "span1200", "span1500", "span1800", "faceCount", "faceWidth", "levelCount"]
};

export async function analyzeScaffoldingPdf(pdfBase64: string): Promise<Partial<ScaffoldingConfig>> {
    const pdfPart = {
        inlineData: {
            mimeType: 'application/pdf',
            data: pdfBase64,
        },
    };

    const textPart = {
        text: `You are an expert assistant for construction scaffolding planning. Analyze the provided PDF scaffolding drawing.
Extract the following parameters and return them in a JSON format.
- The number of spans for each standard length (600mm, 900mm, 1200mm, 1500mm, 1800mm).
- The number of faces (or rows, called '列数' in Japanese).
- The width of the face frame ('枠方向のサイズ' in Japanese), which must be one of 450, 600, 900, or 1200.
- The total number of vertical levels ('段数' in Japanese).
If a specific value cannot be determined from the drawing, set it to 0. For faceWidth, default to 900 if unclear.
`,
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [textPart, pdfPart] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: responseSchema,
            },
        });

        const jsonString = response.text.trim();
        const parsedData = JSON.parse(jsonString);
        
        const sanitizedData: Partial<ScaffoldingConfig> = {};
        for (const key in responseSchema.properties) {
            if (Object.prototype.hasOwnProperty.call(parsedData, key)) {
                const value = Number(parsedData[key]);
                if (!isNaN(value)) {
                     sanitizedData[key as keyof typeof responseSchema.properties] = value;
                }
            }
        }
        
        return sanitizedData;

    } catch (error) {
        console.error("AI analysis failed:", error);
        throw new Error("図面の解析に失敗しました。ファイル形式または内容を確認し、再度お試しください。");
    }
}