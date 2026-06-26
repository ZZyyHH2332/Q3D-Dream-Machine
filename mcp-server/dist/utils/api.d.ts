import OpenAI from "openai";
export declare function getOpenAIClient(): OpenAI;
export declare function generateAvatar(imageBase64: string, style: string, customPrompt?: string): Promise<{
    imageUrl: string;
    revisedPrompt: string;
}>;
export declare function downloadImage(url: string, destPath: string): Promise<void>;
export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}
export declare function chatCompletion(messages: ChatMessage[], options?: {
    maxTokens?: number;
    temperature?: number;
}): Promise<string>;
//# sourceMappingURL=api.d.ts.map