export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}
export declare function generateAvatar(_imageBase64: string, style: string, customPrompt?: string): Promise<{
    imageUrl: string;
    revisedPrompt: string;
}>;
export declare function downloadImage(url: string, destPath: string): Promise<void>;
export declare function chatCompletion(_messages: ChatMessage[], _options?: {
    maxTokens?: number;
    temperature?: number;
}): Promise<string>;
//# sourceMappingURL=api.mock.d.ts.map