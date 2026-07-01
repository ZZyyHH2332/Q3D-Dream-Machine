/**
 * TRAE Native Provider — TRAE 原生多模态协作模式
 *
 * 设计理念：
 * MCP Server 运行在 TRAE 环境中，但无法直接调用 TRAE 的多模态能力
 * （Vision 分析、GenerateImage 图像生成等能力在 TRAE Agent 侧）。
 *
 * 因此 TRAE Native Provider 采用「协作模式」：
 * - 当需要 Vision 分析时，抛出 NEED_VISION_ANALYSIS 信号，
 *   告诉 TRAE Agent：请你用内置 Vision 分析照片，把结果作为 photoAnalysis 参数传回来
 * - 当需要图像生成时，抛出 NEED_IMAGE_GENERATION 信号并附带构建好的 prompt，
 *   告诉 TRAE Agent：请你调用 GenerateImage 工具生成图片，把路径作为 generatedImagePath 参数传回来
 * - 当需要对话补全时，抛出 NEED_CHAT_COMPLETION 信号
 *
 * TRAE Agent 收到信号后，自行完成对应操作，再重新调用工具并传入结果参数，
 * 工具此时就可以直接使用传入的结果，不再触发信号。
 */
import { config, isTraeEnvironment } from "../config.js";
import { TraeCollabSignal, } from "./types.js";
import { buildGeneratePrompt, STYLE_PROMPTS } from "./external-api.js";
/**
 * TRAE 协作模式错误类
 * 用于在 Provider 内部抛出协作信号，上层工具捕获后转换为 MCP 响应
 */
export class TraeCollabError extends Error {
    signal;
    data;
    constructor(signal, message, data = {}) {
        super(message);
        this.name = "TraeCollabError";
        this.signal = signal;
        this.data = data;
    }
}
export const traeNativeProvider = {
    name: "trae-native",
    isAvailable() {
        return isTraeEnvironment() && config.traeVisionEnabled !== false;
    },
    /**
     * TRAE 模式下，Vision 分析由 TRAE Agent 负责
     * 如果调用方没有预先传入 photoAnalysis，就抛出协作信号
     */
    async analyzePhoto(_imageBase64) {
        throw new TraeCollabError(TraeCollabSignal.NEED_VISION_ANALYSIS, "请使用 TRAE 内置 Vision 能力分析照片，并将结果作为 photoAnalysis 参数传入。" +
            "要求返回 JSON 格式，包含字段：gender, ageRange, hairStyle, facialFeatures, clothing, expression, overallVibe", {
            visionPrompt: "Analyze this photo in detail for creating a Q-version (chibi) character avatar. " +
                "Output a JSON object with these exact fields: gender, ageRange, hairStyle, facialFeatures, " +
                "clothing, expression, overallVibe. Be specific about colors.",
        });
    },
    /**
     * TRAE 模式下，图像生成由 TRAE Agent 调用 GenerateImage 工具完成
     * 这里构建好 prompt 后抛出协作信号
     */
    async generateAvatar(prompt, style) {
        throw new TraeCollabError(TraeCollabSignal.NEED_IMAGE_GENERATION, "请使用 TRAE GenerateImage 工具生成 Q 版头像图片。" +
            "生成后将图片本地路径作为 generatedImagePath 参数重新调用 q3d_generate_avatar。", {
            imagePrompt: prompt,
            imageSize: "1024x1024",
            style,
            styleName: STYLE_PROMPTS[style] ? style : "kawaii",
            suggestion: "使用 GenerateImage 工具，prompt 参照上方 imagePrompt，尺寸建议 1024x1024",
        });
    },
    /**
     * TRAE 模式下，对话由 TRAE Agent 直接生成
     * （通常 MCP 的 chat_with_pet 工具在 TRAE 模式下不会被调用，
     * 因为 TRAE Agent 自己就可以和用户聊天）
     */
    async chatCompletion(_messages, _options) {
        throw new TraeCollabError(TraeCollabSignal.NEED_CHAT_COMPLETION, "请使用 TRAE 内置对话模型生成回复。");
    },
};
/**
 * 便捷函数：根据风格 + 分析结果构建生成 prompt
 * （复用 external-api 的 prompt 构建逻辑，确保风格一致）
 */
export function buildTraeGeneratePrompt(style, analysis, customPrompt) {
    return buildGeneratePrompt(style, analysis, customPrompt);
}
//# sourceMappingURL=trae-native.js.map