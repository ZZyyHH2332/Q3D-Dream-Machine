import OpenAI from "openai";
import fs from "fs";
import { config } from "../config.js";
// Mock mode: delegate to api.mock.ts when Q3D_TEST_MODE=mock
if (config.testMode) {
    console.error("[Q3D] MOCK mode active - AI APIs bypassed");
}
let openaiClient = null;
export function getOpenAIClient() {
    if (!openaiClient) {
        if (!config.apiKey) {
            throw new Error("API key not configured. Please copy .env.example to .env and set Q3D_API_KEY.");
        }
        openaiClient = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.apiBase,
        });
    }
    return openaiClient;
}
const STYLE_PROMPTS = {
    kawaii: "转换为软萌大头Q版风格，头部比例放大至全身1/2以上，眼睛圆润明亮占脸1/3，小鼻子微笑嘴型。默认配色：粉色、奶白色、浅紫色为主色调。线条圆润柔和无锐利棱角。背景纯色或简单几何图案。必须保留原照片发色、发型、眼镜等核心特征。English: soft pastel colors, big sparkling eyes, kawaii anime chibi style, round face, adorable, pink and mint tones",
    guofeng: "转换为国风Q版风格，水墨感清雅含蓄，可含汉服或现代中式穿搭元素。默认配色：青绿、墨黑、宣纸白为主。线条带有书法笔触感飘逸流畅。背景可含淡墨山水或留白。必须保留原照片人物气质和核心面部特征。English: Chinese traditional style, ink wash aesthetics, elegant muted colors, flowing hanfu or modern Chinese fashion, graceful",
    trendy: "转换为潮玩手办风格，类似盲盒玩具质感，高饱和度配色，轮廓锐利。默认配色：霓虹色、金属色、撞色为主。线条清晰硬边阴影分明。背景纯色高对比或渐变。必须保留原照片核心识别特征（发型、眼镜、标志性配饰）。English: trendy toy figure style, bold saturated colors, sharp outlines, blind box toy aesthetic, collectible figure look",
    simple: "转换为简约卡通风格，极简几何感，色块平涂无复杂纹理。默认配色：黑白灰+单强调色。线条干净一笔画无多余装饰。背景必须极简无场景元素。保留核心轮廓和发色即可，细节可简化。English: minimalist cartoon style, clean lines, flat colors, geometric shapes, simple and cute, modern illustration",
};
// Prompt preprocessing helpers
function sanitizeCustomPrompt(input) {
    if (!input)
        return "";
    const cleaned = input.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s,，.。!！?？:：;；""''（）()【】\-—/|+=%&@#*~^]/g, "").trim();
    return cleaned.slice(0, 300);
}
function convertNegationToAffirmation(input) {
    if (!input)
        return "";
    const negationMap = {
        "不要背景": "纯白背景，无其他元素",
        "不要颜色": "黑白配色，无彩色",
        "不要阴影": "无阴影，平面化处理",
        "不要复杂": "极简风格，简单干净",
        "不要粉色": "不使用粉色",
        "避免": "使用相反的做法",
        "禁止": "不使用",
        "不许": "不使用",
        "不能": "无法",
        "不该": "不应",
    };
    let result = input;
    for (const [neg, aff] of Object.entries(negationMap)) {
        if (result.includes(neg)) {
            result = result.split(neg).join(aff);
        }
    }
    return result;
}
function validatePromptLength(prompt) {
    const MAX_LENGTH = 1000;
    if (prompt.length <= MAX_LENGTH) {
        return { valid: true, prompt };
    }
    const truncated = prompt.slice(0, 600) + " ... [truncated] ... " + prompt.slice(-380);
    return {
        valid: false,
        prompt: truncated.slice(0, MAX_LENGTH),
        warning: `Prompt truncated from ${prompt.length} to ${MAX_LENGTH} chars. Consider shortening customPrompt.`,
    };
}
function mergePrompts(styleDesc, descText, customPrompt) {
    const basePrompt = `A cute Q-version (chibi) character portrait. ${styleDesc}. The character is based on: ${descText}. Big head proportion, small body, adorable expression. Clean light background, high quality digital art, character facing forward.`;
    if (!customPrompt)
        return basePrompt;
    return `${basePrompt} | User's additional requirements (highest priority): ${customPrompt}. If additional requirements conflict with the default style, follow the additional requirements.`;
}
export async function generateAvatar(imageBase64, style, customPrompt) {
    if (config.testMode) {
        const mock = await import("./api.mock.js");
        return mock.generateAvatar(imageBase64, style, customPrompt);
    }
    const client = getOpenAIClient();
    // Step 1: Analyze photo with GPT-4o vision for person description
    let description = "a person";
    try {
        const analysisResponse = await client.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `Analyze this photo in detail for creating a Q-version (chibi) character avatar. Output a JSON object with these exact fields:
- gender: "male" or "female"
- ageRange: e.g., "20s", "30s", "teen"
- hairStyle: detailed description (color, length, style)
- facialFeatures: eye shape, nose, mouth, skin tone
- clothing: type, color, pattern, accessories
- expression: current expression
- overallVibe: one-word summary of the person's aesthetic

Be specific about colors. Keep each field under 30 words.`,
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/png;base64,${imageBase64}`,
                            },
                        },
                    ],
                },
            ],
            max_tokens: 300,
            response_format: { type: "json_object" },
        });
        description =
            analysisResponse.choices[0]?.message?.content || "a person";
    }
    catch (err) {
        // If vision analysis fails, continue with generic description
        console.error("Vision analysis failed, using generic description:", err.message);
    }
    // Step 2: Parse structured description for richer DALL-E prompt
    let descText = description;
    try {
        const structured = JSON.parse(description);
        descText = `gender: ${structured.gender}, age: ${structured.ageRange}, hair: ${structured.hairStyle}, face: ${structured.facialFeatures}, clothing: ${structured.clothing}, expression: ${structured.expression}, vibe: ${structured.overallVibe}`;
    }
    catch {
        // Use raw text description as fallback
    }
    // Step 3: Generate Q-version image with DALL-E 3
    const styleDesc = STYLE_PROMPTS[style] || STYLE_PROMPTS.kawaii;
    // Step 3a: Preprocess customPrompt
    let processedCustomPrompt = undefined;
    if (customPrompt) {
        processedCustomPrompt = sanitizeCustomPrompt(customPrompt);
        if (processedCustomPrompt.length === 0) {
            throw new Error("GENERATE_AVATAR_PROMPT_INVALID: Custom prompt contains only invalid characters");
        }
        processedCustomPrompt = convertNegationToAffirmation(processedCustomPrompt);
    }
    // Step 3b: Build prompt with fusion logic
    let prompt = mergePrompts(styleDesc, descText, processedCustomPrompt);
    // Step 3c: Validate and truncate if needed
    const lengthCheck = validatePromptLength(prompt);
    if (!lengthCheck.valid) {
        console.warn(`[api] ${lengthCheck.warning}`);
        prompt = lengthCheck.prompt;
        if (prompt.length > 1000) {
            throw new Error("GENERATE_AVATAR_PROMPT_TOO_LONG: Final prompt exceeds maximum length even after truncation");
        }
    }
    const imageResponse = await client.images.generate({
        model: "dall-e-3",
        prompt,
        size: "1024x1024",
        quality: "standard",
        n: 1,
    });
    const imageUrl = imageResponse.data?.[0]?.url;
    if (!imageUrl) {
        throw new Error("Image generation returned no URL");
    }
    return {
        imageUrl,
        revisedPrompt: imageResponse.data?.[0]?.revised_prompt || prompt,
    };
}
export async function downloadImage(url, destPath) {
    if (config.testMode && url.startsWith("mock://")) {
        const mock = await import("./api.mock.js");
        return mock.downloadImage(url, destPath);
    }
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(destPath, buffer);
}
export async function chatCompletion(messages, options) {
    if (config.testMode) {
        const mock = await import("./api.mock.js");
        return mock.chatCompletion(messages, options);
    }
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages,
        max_tokens: options?.maxTokens || 200,
        temperature: options?.temperature || 0.8,
    });
    return response.choices[0]?.message?.content || "...";
}
//# sourceMappingURL=api.js.map