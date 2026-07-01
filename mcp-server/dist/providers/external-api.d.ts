import { IAvatarProvider, PhotoAnalysis } from "./types.js";
declare const STYLE_PROMPTS: Record<string, string>;
export declare const externalApiProvider: IAvatarProvider;
/**
 * 便捷函数：根据风格 + 分析结果 + 自定义提示词构建完整的生成 prompt
 * （从 api.ts 中提取，供各 Provider 复用）
 */
export declare function buildGeneratePrompt(style: string, analysis: PhotoAnalysis, customPrompt?: string): string;
export { STYLE_PROMPTS };
//# sourceMappingURL=external-api.d.ts.map