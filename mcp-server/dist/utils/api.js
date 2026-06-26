import OpenAI from "openai";
import fs from "fs";
import { config } from "../config.js";
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
    kawaii: "soft pastel colors, big sparkling eyes, kawaii anime chibi style, round face, adorable, pink and mint tones",
    guofeng: "Chinese traditional style, ink wash aesthetics, elegant muted colors, flowing hanfu or modern Chinese fashion, graceful",
    trendy: "trendy toy figure style, bold saturated colors, sharp outlines, blind box toy aesthetic, collectible figure look",
    simple: "minimalist cartoon style, clean lines, flat colors, geometric shapes, simple and cute, modern illustration",
};
export async function generateAvatar(imageBase64, style, customPrompt) {
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
                            text: "Describe the person in this photo briefly: gender, age range, hairstyle, facial features, clothing, and expression. Keep under 60 words.",
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
            max_tokens: 150,
        });
        description =
            analysisResponse.choices[0]?.message?.content || "a person";
    }
    catch (err) {
        // If vision analysis fails, continue with generic description
        console.error("Vision analysis failed, using generic description:", err.message);
    }
    // Step 2: Generate Q-version image with DALL-E 3
    const styleDesc = STYLE_PROMPTS[style] || STYLE_PROMPTS.kawaii;
    const prompt = customPrompt
        ? `${customPrompt}. The character is based on: ${description}`
        : `A cute Q-version (chibi) character portrait. ${styleDesc}. The character is based on: ${description}. Big head proportion, small body, adorable expression. Clean light background, high quality digital art, character facing forward.`;
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
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(destPath, buffer);
}
export async function chatCompletion(messages, options) {
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