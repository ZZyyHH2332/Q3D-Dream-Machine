/**
 * 模型适配 Prompt 优化器
 *
 * 为不同 TRAE Auto Mode 模型生成定制化 prompt。
 * 不同模型有不同的 prompt 格式偏好和 token 利用率：
 *
 * - Doubao-Seed-2.1-Turbo: 适合图像生成 prompt，英文简短
 * - GLM-5.2: 适合中英混合 prompt，代码注释详尽
 * - DeepSeek-V4-Pro: 适合 Chain-of-Thought 推理格式
 * - Kimi-K2.7-Code: 适合代码框架+API 参考，长上下文
 * - Qwen3.7-Plus: 适合多模态对比分析，空间描述
 * - MiniMax-M3: 适合参数化精确描述，工程术语
 */
import { PhotoAnalysis } from "../providers/types.js";
/** Prompt 策略 */
export type PromptStrategy = "structured_json" | "image_generation" | "creative_english" | "code_generation" | "debugging" | "comparative_analysis" | "multiview" | "engineering_params";
/** 模型 Prompt 配置 */
export interface ModelPromptConfig {
    modelId: string;
    strategy: PromptStrategy;
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
    formatInstructions: string;
}
/**
 * 根据模型 ID 获取 Prompt 配置
 */
export declare function getModelPromptConfig(modelId: string): ModelPromptConfig;
/**
 * 为脚本生成任务构建模型适配的 system prompt
 */
export declare function buildScriptSystemPrompt(modelId: string): string;
/**
 * 为脚本生成任务构建模型适配的格式指令
 */
export declare function buildFormatInstructions(modelId: string): string;
/**
 * 为脚本生成任务构建完整 prompt
 * 根据模型特点调整 prompt 结构和侧重点
 */
export declare function buildModelAdaptedScriptPrompt(modelId: string, basePrompt: string, referenceSnippets?: string): string;
/**
 * 为质量评估任务构建 prompt
 */
export declare function buildQualityAssessmentPrompt(modelId: string, referencePaths: string[], renderPaths: string[]): string;
/**
 * 为多视图生成任务构建 prompt
 */
export declare function buildMultiviewPrompt(modelId: string, viewType: "front" | "side" | "back", analysis: PhotoAnalysis, style: string): string;
//# sourceMappingURL=prompt-optimizer.d.ts.map