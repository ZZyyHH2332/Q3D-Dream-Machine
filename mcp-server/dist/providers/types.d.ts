/**
 * Provider 类型定义
 * Q3D AI 能力统一接口，支持多种实现（TRAE Native / External API / Mock）
 */
export interface PhotoAnalysis {
    gender: string;
    ageRange: string;
    hairStyle: string;
    facialFeatures: string;
    clothing: string;
    expression: string;
    overallVibe: string;
}
export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}
export interface ChatOptions {
    maxTokens?: number;
    temperature?: number;
}
export interface AvatarGenerateResult {
    imageUrl: string;
    revisedPrompt: string;
}
/**
 * TRAE Native 模式下的协作信号
 * 当 MCP Server 无法直接执行 AI 能力时，返回这些信号给 TRAE Agent，
 * 由 TRAE Agent 完成后通过参数回传结果。
 */
export declare enum TraeCollabSignal {
    /** 需要 Vision 分析照片，TRAE Agent 应自行分析后传入 photoAnalysis 参数 */
    NEED_VISION_ANALYSIS = "NEED_VISION_ANALYSIS",
    /** 需要生成图像，TRAE Agent 应调用 GenerateImage 后传入 generatedImagePath 参数 */
    NEED_IMAGE_GENERATION = "NEED_IMAGE_GENERATION",
    /** 需要对话补全，TRAE Agent 应自行生成回复 */
    NEED_CHAT_COMPLETION = "NEED_CHAT_COMPLETION",
    /** 需要 Prompt 优化，TRAE Agent 应使用指定模型优化图像生成 prompt */
    NEED_PROMPT_OPTIMIZATION = "NEED_PROMPT_OPTIMIZATION"
}
/**
 * TRAE 协作模式的返回结构
 * 当 provider=trae 且缺少必要输入时，返回此结构引导 TRAE Agent
 */
export interface TraeCollabResponse {
    success: false;
    signal: TraeCollabSignal;
    message: string;
    /** 当 signal=NEED_VISION_ANALYSIS 时，提示分析要求 */
    visionPrompt?: string;
    /** 当 signal=NEED_IMAGE_GENERATION 时，提供构建好的 prompt */
    imagePrompt?: string;
    /** 当 signal=NEED_IMAGE_GENERATION 时，建议的图片尺寸 */
    imageSize?: string;
    /** 当 signal=NEED_PROMPT_OPTIMIZATION 时，提供优化模板和要求 */
    optimizePromptTemplate?: string;
    /** 当 signal=NEED_PROMPT_OPTIMIZATION 时，照片分析结果 */
    analysis?: PhotoAnalysis;
    /** 当 signal=NEED_PROMPT_OPTIMIZATION 时，目标风格 */
    style?: string;
    /** 指定使用的模型 ID */
    model?: string;
    /** 指定使用的模型名称（中文） */
    modelName?: string;
}
export interface IAvatarProvider {
    /** Provider 名称 */
    readonly name: string;
    /** 可用性检测 */
    isAvailable(): Promise<boolean> | boolean;
    /**
     * Vision 分析：从照片提取人物特征
     * @param imageBase64 - 图片 base64 编码（不含 data:image 前缀）
     * @returns 结构化的人物特征分析
     * @throws TraeCollabSignal - TRAE 模式下可能抛出协作信号
     */
    analyzePhoto(imageBase64: string): Promise<PhotoAnalysis>;
    /**
     * 图像生成：根据 prompt 生成 Q 版形象
     * @param prompt - 完整的生成提示词
     * @param style - 风格名称（kawaii/guofeng/trendy/simple）
     * @returns 图片 URL（或本地路径）+ 实际使用的 prompt
     * @throws TraeCollabSignal - TRAE 模式下可能抛出协作信号
     */
    generateAvatar(prompt: string, style: string): Promise<AvatarGenerateResult>;
    /**
     * 文本对话
     * @param messages - 消息历史
     * @param options - 对话选项
     * @returns 回复文本
     * @throws TraeCollabSignal - TRAE 模式下可能抛出协作信号
     */
    chatCompletion(messages: ChatMessage[], options?: ChatOptions): Promise<string>;
    /**
     * 【可选】使用指定 Auto Mode 模型分析照片
     * 当 provider 支持多模型协作时实现此方法
     * @param imageBase64 - 图片 base64 编码
     * @param model - Auto Mode 模型 ID（如 "Doubao-Seed-2.1-Pro"）
     * @returns 结构化的人物特征分析
     * @throws TraeCollabSignal - TRAE 模式下抛出协作信号，指示 Agent 使用指定模型分析
     */
    analyzePhotoWithModel?(imageBase64: string, model: string): Promise<PhotoAnalysis>;
    /**
     * 【可选】使用指定 Auto Mode 模型优化图像生成 prompt
     * 当 provider 支持多模型协作时实现此方法
     * @param analysis - 照片分析结果
     * @param style - 目标风格
     * @param model - Auto Mode 模型 ID
     * @returns 优化后的英文 prompt
     * @throws TraeCollabSignal - TRAE 模式下抛出协作信号，指示 Agent 使用指定模型优化
     */
    optimizePromptWithModel?(analysis: PhotoAnalysis, style: string, model: string): Promise<string>;
}
//# sourceMappingURL=types.d.ts.map