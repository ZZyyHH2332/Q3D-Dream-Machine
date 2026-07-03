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

import { config, isTraeEnvironment } from "../config.js";
import {
  IAvatarProvider,
  PhotoAnalysis,
  ChatMessage,
  ChatOptions,
  AvatarGenerateResult,
  TraeCollabSignal,
} from "./types.js";
import { buildGeneratePrompt, STYLE_PROMPTS } from "./external-api.js";

/**
 * TRAE 协作模式错误类
 * 用于在 Provider 内部抛出协作信号，上层工具捕获后转换为 MCP 响应
 */
export class TraeCollabError extends Error {
  signal: TraeCollabSignal;
  data: Record<string, any>;

  constructor(signal: TraeCollabSignal, message: string, data: Record<string, any> = {}) {
    super(message);
    this.name = "TraeCollabError";
    this.signal = signal;
    this.data = data;
  }
}

/**
 * 支持的 Auto Mode 模型列表
 */
export const AUTO_MODE_MODELS = [
  { id: "Doubao-Seed-2.1-Pro", name: "豆包 Seed 2.1 Pro", desc: "分析最详细，推荐高质量生成" },
  { id: "Doubao-Seed-2.1-Turbo", name: "豆包 Seed 2.1 Turbo", desc: "速度快，质量适中" },
  { id: "GLM-5.2", name: "智谱 GLM 5.2", desc: "代码能力强，prompt 优化好" },
  { id: "GLM-5", name: "智谱 GLM 5", desc: "稳定可靠" },
  { id: "DeepSeek-V4-Pro", name: "DeepSeek V4 Pro", desc: "推理能力强" },
  { id: "DeepSeek-V4-Flash", name: "DeepSeek V4 Flash", desc: "速度快" },
  { id: "Kimi-K2.7", name: "Kimi K2.7", desc: "长上下文，适合复杂分析" },
  { id: "Qwen3.7-Plus", name: "通义千问 3.7 Plus", desc: "多模态理解好" },
  { id: "MiniMax-M3", name: "MiniMax M3", desc: "工程能力强" },
  { id: "auto", name: "自动选择", desc: "根据照片复杂度自动选择" },
];

/**
 * 根据模型 ID 获取模型信息
 */
export function getModelInfo(modelId: string): { id: string; name: string; desc: string } | undefined {
  return AUTO_MODE_MODELS.find(m => m.id === modelId);
}

export const traeNativeProvider: IAvatarProvider = {
  name: "trae-native",

  isAvailable(): boolean {
    return isTraeEnvironment() && config.traeVisionEnabled !== false;
  },

  /**
   * TRAE 模式下，Vision 分析由 TRAE Agent 负责
   * 如果调用方没有预先传入 photoAnalysis，就抛出协作信号
   */
  async analyzePhoto(_imageBase64: string): Promise<PhotoAnalysis> {
    throw new TraeCollabError(
      TraeCollabSignal.NEED_VISION_ANALYSIS,
      "请使用 TRAE 内置 Vision 能力分析照片，并将结果作为 photoAnalysis 参数传入。" +
        "要求返回 JSON 格式，包含字段：gender, ageRange, hairStyle, facialFeatures, clothing, expression, overallVibe",
      {
        visionPrompt:
          "Analyze this photo in detail for creating a Q-version (chibi) character avatar. " +
          "Output a JSON object with these exact fields: gender, ageRange, hairStyle, facialFeatures, " +
          "clothing, expression, overallVibe. Be specific about colors.",
      }
    );
  },

  /**
   * 【增强】使用指定 Auto Mode 模型分析照片
   * 让 TRAE Agent 用指定的模型（如 Doubao-Seed-2.1-Pro）分析照片
   */
  async analyzePhotoWithModel(imageBase64: string, model: string): Promise<PhotoAnalysis> {
    const modelInfo = getModelInfo(model);
    const modelName = modelInfo ? modelInfo.name : model;

    throw new TraeCollabError(
      TraeCollabSignal.NEED_VISION_ANALYSIS,
      `请使用 TRAE Auto Mode 的 ${modelName} 模型分析照片，并将结果作为 photoAnalysis 参数传入。`,
      {
        model,
        modelName,
        visionPrompt: `请使用 ${modelName} 模型分析这张照片，提取以下特征用于生成 Q 版形象：

要求：
1. 详细描述人物的五官特征（眼睛大小、鼻子形状、嘴巴特点等）
2. 详细描述发型和发色
3. 详细描述服装颜色和款式
4. 描述表情和整体气质
5. 输出格式：JSON 对象，包含以下字段：
   - gender（性别）
   - ageRange（年龄段，如 20-30）
   - hairStyle（发型，详细描述颜色和造型）
   - facialFeatures（五官特征，详细描述）
   - clothing（服装，详细描述颜色和款式）
   - expression（表情）
   - overallVibe（整体气质）

请尽可能详细，这些信息将用于生成高质量的 Q 版形象。`,
      }
    );
  },

  /**
   * 【增强】使用指定 Auto Mode 模型优化 prompt
   * 让 TRAE Agent 用指定的模型生成更精准的图像生成 prompt
   */
  async optimizePromptWithModel(
    analysis: PhotoAnalysis,
    style: string,
    model: string
  ): Promise<string> {
    const modelInfo = getModelInfo(model);
    const modelName = modelInfo ? modelInfo.name : model;
    const styleDesc = STYLE_PROMPTS[style] || "软萌大头";

    throw new TraeCollabError(
      TraeCollabSignal.NEED_PROMPT_OPTIMIZATION,
      `请使用 TRAE Auto Mode 的 ${modelName} 模型，根据照片分析结果生成高质量的图像生成 prompt。`,
      {
        model,
        modelName,
        action: "optimize_prompt",
        analysis,
        style,
        styleDesc,
        promptTemplate: `你是一位专业的 Q 版形象设计师和 AI 图像生成专家。请根据以下照片分析结果，生成一个用于 AI 图像生成的高质量英文 prompt。

照片分析结果：
${JSON.stringify(analysis, null, 2)}

目标风格：${style}（${styleDesc}）

要求：
1. prompt 必须用英文
2. 要详细描述人物的五官、发型、服装、表情
3. 要包含风格关键词（如 chibi, Q-version, cute, cartoon, anime 等）
4. 要包含质量关键词（如 high quality, detailed, professional, masterpiece 等）
5. 要包含渲染关键词（如 3D render, soft lighting, smooth skin 等）
6. 长度控制在 100-200 词
7. 只输出 prompt 本身，不要其他内容

示例格式：
A cute chibi character with [具体特征], [发型描述], [服装描述], [表情描述]. Style: Q-version, cartoon, anime. High quality, detailed, professional, masterpiece. 3D render, soft lighting, smooth skin.`,
      }
    );
  },

  /**
   * TRAE 模式下，图像生成由 TRAE Agent 调用 GenerateImage 工具完成
   * 这里构建好 prompt 后抛出协作信号
   */
  async generateAvatar(
    prompt: string,
    style: string
  ): Promise<AvatarGenerateResult> {
    throw new TraeCollabError(
      TraeCollabSignal.NEED_IMAGE_GENERATION,
      "请使用 TRAE GenerateImage 工具生成 Q 版头像图片。" +
        "生成后将图片本地路径作为 generatedImagePath 参数重新调用 q3d_generate_avatar。",
      {
        imagePrompt: prompt,
        imageSize: "1024x1024",
        style,
        styleName: STYLE_PROMPTS[style] ? style : "kawaii",
        suggestion:
          "使用 GenerateImage 工具，prompt 参照上方 imagePrompt，尺寸建议 1024x1024",
      }
    );
  },

  /**
   * TRAE 模式下，对话由 TRAE Agent 直接生成
   * （通常 MCP 的 chat_with_pet 工具在 TRAE 模式下不会被调用，
   * 因为 TRAE Agent 自己就可以和用户聊天）
   */
  async chatCompletion(
    _messages: ChatMessage[],
    _options?: ChatOptions
  ): Promise<string> {
    throw new TraeCollabError(
      TraeCollabSignal.NEED_CHAT_COMPLETION,
      "请使用 TRAE 内置对话模型生成回复。"
    );
  },
};

/**
 * 便捷函数：根据风格 + 分析结果构建生成 prompt
 * （复用 external-api 的 prompt 构建逻辑，确保风格一致）
 */
export function buildTraeGeneratePrompt(
  style: string,
  analysis: PhotoAnalysis,
  customPrompt?: string
): string {
  return buildGeneratePrompt(style, analysis, customPrompt);
}
