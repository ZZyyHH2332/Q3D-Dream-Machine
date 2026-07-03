/**
 * TRAE Native Provider — TRAE 原生多模态协作模式（增强版）
 *
 * 设计理念：
 * MCP Server 运行在 TRAE 环境中，但无法直接调用 TRAE 的多模态能力
 * （Vision 分析、GenerateImage 图像生成等能力在 TRAE Agent 侧）。
 *
 * 因此 TRAE Native Provider 采用「协作模式」：
 * - 当需要 Vision 分析时，抛出 NEED_VISION_ANALYSIS 信号，
 *   告诉 TRAE Agent：请你用内置 Vision 或指定 Auto Mode 模型分析照片，把结果作为 photoAnalysis 参数传回来
 * - 当需要图像生成时，抛出 NEED_IMAGE_GENERATION 信号并附带构建好的 prompt，
 *   告诉 TRAE Agent：请你调用 GenerateImage 工具生成图片，把路径作为 generatedImagePath 参数传回来
 * - 当需要对话补全或 prompt 优化时，抛出 NEED_CHAT_COMPLETION 信号
 *
 * TRAE Agent 收到信号后，自行完成对应操作，再重新调用工具并传入结果参数，
 * 工具此时就可以直接使用传入的结果，不再触发信号。
 *
 * 增强功能：
 * - 支持指定 Auto Mode 模型（Doubao-Seed-2.1-Pro、GLM-5.2、DeepSeek-V4-Pro 等）
 * - 支持 prompt 优化（用文本模型生成更精准的图像生成 prompt）
 * - 支持多模型协作（分析 + 优化 + 生成）
 */
import { IAvatarProvider, PhotoAnalysis, TraeCollabSignal } from "./types.js";
/**
 * TRAE 协作模式错误类
 * 用于在 Provider 内部抛出协作信号，上层工具捕获后转换为 MCP 响应
 */
export declare class TraeCollabError extends Error {
    signal: TraeCollabSignal;
    data: Record<string, any>;
    constructor(signal: TraeCollabSignal, message: string, data?: Record<string, any>);
}
/**
 * 支持的 Auto Mode 模型列表
 */
export declare const AUTO_MODE_MODELS: {
    id: string;
    name: string;
    desc: string;
}[];
/**
 * 根据模型 ID 获取模型信息
 */
export declare function getModelInfo(modelId: string): {
    id: string;
    name: string;
    desc: string;
} | undefined;
export declare const traeNativeProvider: IAvatarProvider;
/**
 * 便捷函数：根据风格 + 分析结果构建生成 prompt
 * （复用 external-api 的 prompt 构建逻辑，确保风格一致）
 */
export declare function buildTraeGeneratePrompt(style: string, analysis: PhotoAnalysis, customPrompt?: string): string;
//# sourceMappingURL=trae-native.d.ts.map