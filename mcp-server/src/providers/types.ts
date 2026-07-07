/**
 * Provider 类型定义
 * Q3D AI 能力统一接口，支持多种实现（TRAE Native / External API / Mock）
 */

export interface PhotoAnalysis {
  gender: string;
  ageRange: string;
  hair: {
    style: string;
    color: string;
    details?: string;
    volume?: string;
  };
  eyes: {
    color: string;
    size: string;
    shape?: string;
    expression?: string;
  };
  facialFeatures: {
    nose?: string;
    mouth?: string;
    faceShape?: string;
    specialMarks?: string;
  };
  outfit: {
    top: string;
    bottom: string;
    outerwear?: string;
    shoes?: string;
    material?: string;
    pattern?: string;
  };
  accessories?: Array<{
    type: string;
    description: string;
    material?: string;
    color?: string;
  }>;
  expression: string;
  pose?: string;
  overallVibe: string;
  special_features?: string[];
  // 兼容旧格式（可选，用于向后兼容）
  legacy_hairStyle?: string;
  legacy_clothing?: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** PBR 材质参数（GLM-5.2 提取 + MiniMax-M3 精调） */
export interface MaterialParams {
  [part: string]: {
    baseColor: string;
    baseColorRGBA?: [number, number, number, number];
    roughness: number;
    metallic: number;
    subsurface?: number;
    subsurfaceRadius?: [number, number, number];
    specularIOR?: number;
    sheenWeight?: number;
    coatWeight?: number;
    coatRoughness?: number;
    texturePath?: string;
  };
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
export enum TraeCollabSignal {
  /** 需要 Vision 分析照片，TRAE Agent 应自行分析后传入 photoAnalysis 参数 */
  NEED_VISION_ANALYSIS = "NEED_VISION_ANALYSIS",
  /** 需要上传照片 */
  NEED_PHOTO_UPLOAD = "NEED_PHOTO_UPLOAD",
  /** 需要生成图像，TRAE Agent 应调用 GenerateImage 后传入 generatedImagePath 参数 */
  NEED_IMAGE_GENERATION = "NEED_IMAGE_GENERATION",
  /** 需要对话补全，TRAE Agent 应自行生成回复 */
  NEED_CHAT_COMPLETION = "NEED_CHAT_COMPLETION",
  /** 需要 Prompt 优化，TRAE Agent 应使用指定模型优化图像生成 prompt */
  NEED_PROMPT_OPTIMIZATION = "NEED_PROMPT_OPTIMIZATION",
  /** 需要生成多视图图像（front/side/back），TRAE Agent 应调用 GenerateImage 3 次后传入 generatedImagePaths 参数 */
  NEED_MULTIVIEW_GENERATION = "NEED_MULTIVIEW_GENERATION",
  /** 需要生成 Blender Python 脚本，TRAE Agent 应使用文本模型生成脚本后传入 scriptPath 参数 */
  NEED_SCRIPT_GENERATION = "NEED_SCRIPT_GENERATION",
  /** 批量多视图 Pipeline：一次性完成 Vision 分析 + 三视图生成 */
  NEED_MULTIVIEW_PIPELINE = "NEED_MULTIVIEW_PIPELINE",
  /** 批量脚本 Pipeline：一次性完成脚本生成 + 模型选择 */
  NEED_SCRIPT_PIPELINE = "NEED_SCRIPT_PIPELINE",
  /** 需要质量评估：对比 GLB 渲染图与参考图，给出评分和改进建议 */
  NEED_QUALITY_ASSESSMENT = "NEED_QUALITY_ASSESSMENT",
  /** 需要纹理生成：TRAE Agent 应调用 GenerateImage 生成纹理贴图 */
  NEED_TEXTURE_GENERATION = "NEED_TEXTURE_GENERATION",
  /** 需要材质参数提取：TRAE Agent 应分析纹理图提取 PBR 参数 */
  NEED_MATERIAL_EXTRACTION = "NEED_MATERIAL_EXTRACTION",
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
  /** 模型路由信息（推荐模型 + 降级模型） */
  modelRoute?: {
    modelId: string;
    modelName: string;
    reasoning: string;
    fallbackModelId?: string;
    fallbackModelName?: string;
  };
  /** 批量任务列表（用于 NEED_MULTIVIEW_PIPELINE / NEED_SCRIPT_PIPELINE 信号） */
  tasks?: Array<{
    order: number;
    task: string;
    model: { id: string; name: string };
    instruction: string;
    outputKey: string;
    dependsOn?: string;
    prompt?: string;
    scriptContent?: string;
  }>;
  /** 是否自动触发质量评估 */
  autoAssessment?: boolean;
  /** 质量评估所需数据 */
  qualityAssessment?: {
    referencePaths: string[];
    renderPaths?: string[];
  };
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
  optimizePromptWithModel?(
    analysis: PhotoAnalysis,
    style: string,
    model: string
  ): Promise<string>;
}
