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
export type PromptStrategy =
  | "structured_json"
  | "image_generation"
  | "creative_english"
  | "code_generation"
  | "debugging"
  | "comparative_analysis"
  | "multiview"
  | "engineering_params"
  | "texture_generation"
  | "material_extraction";

/** 模型 Prompt 配置 */
export interface ModelPromptConfig {
  modelId: string;
  strategy: PromptStrategy;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  formatInstructions: string;
}

/** 模型 Prompt 配置表 */
const MODEL_PROMPT_CONFIGS: Record<string, ModelPromptConfig> = {
  "Doubao-Seed-2.1-Turbo": {
    modelId: "Doubao-Seed-2.1-Turbo",
    strategy: "image_generation",
    temperature: 0.5,
    maxTokens: 2048,
    systemPrompt: "You are a professional AI image prompt engineer. Generate high-quality English prompts for 3D character generation.",
    formatInstructions: "Output only the prompt text, no markdown or explanations.",
  },
  "GLM-5.2": {
    modelId: "GLM-5.2",
    strategy: "creative_english",
    temperature: 0.7,
    maxTokens: 2048,
    systemPrompt: "You are a professional AI image prompt engineer. Generate high-quality English prompts for 3D character generation.",
    formatInstructions: "Output only the prompt text, no explanations or markdown.",
  },
  "Kimi-K2.7": {
    modelId: "Kimi-K2.7",
    strategy: "code_generation",
    temperature: 0.2,
    maxTokens: 16384,
    systemPrompt: `你是一位资深 3D 角色艺术家和 Blender Python 专家。
请生成完整可运行的 Python 脚本。代码必须包含：
- import bpy, import math, from mathutils import Vector, Euler
- 场景清理、角色创建、材质、灯光、GLB 导出
- 对所有部件进行 UV 展开（smart_uv_unwrap / cube_uv_project / cylinder_uv_project）
- 使用 create_textured_material 为每个部件加载纹理贴图创建 PBR 材质
- 使用 create_blended_material 实现纯色+纹理混合（如星点图案叠加在裙摆上）
- 不要使用基元体拼凑，要使用细分曲面、贝塞尔曲线、融球等高级技术`,
    formatInstructions: "只输出 Python 代码，不要包含 markdown 代码块标记或其他解释。",
  },
  "DeepSeek-V4-Pro": {
    modelId: "DeepSeek-V4-Pro",
    strategy: "debugging",
    temperature: 0.1,
    maxTokens: 8192,
    systemPrompt: `你是一位 Blender Python 调试专家。
请分析错误日志，定位问题根因，然后输出修复后的完整脚本。
分析步骤：
1. 识别错误类型（语法错误/API 错误/逻辑错误）
2. 定位错误行号和上下文
3. 提出修复方案
4. 输出修复后的完整脚本`,
    formatInstructions: "先简要分析错误原因（1-2行注释），然后输出完整修复后的 Python 代码。",
  },
  "Qwen3.7-Plus": {
    modelId: "Qwen3.7-Plus",
    strategy: "comparative_analysis",
    temperature: 0.3,
    maxTokens: 4096,
    systemPrompt: `你是一位 3D 模型质量评估专家。
请对比参考图和渲染图，从以下维度评估：
1. 轮廓匹配度 - 3D 模型轮廓是否与参考图一致
2. 比例准确性 - 身体各部分比例是否正确
3. 色彩还原度 - 颜色是否准确还原
4. 细节完整度 - 配饰、发型等细节是否到位
5. 材质质量 - PBR 材质是否真实`,
    formatInstructions: "输出 JSON 格式的评分和建议。",
  },
  "MiniMax-M3": {
    modelId: "MiniMax-M3",
    strategy: "engineering_params",
    temperature: 0.2,
    maxTokens: 4096,
    systemPrompt: `你是一位 Blender PBR 材质参数精调专家。
请分析粗粒度材质参数，输出精确的数值优化建议。
精调维度：
1. Roughness：0=镜面，1=磨砂 — 皮肤 0.3-0.5，布料 0.4-0.7，金属 0.1-0.3
2. Metallic：0=非金属，1=纯金属 — 皮肤/布料 0，珠宝 0.5-0.9
3. Subsurface：皮肤散射 — 皮肤 0.05-0.2，Radius 用 (1.0,0.3,0.1) 暖色调
4. Specular IOR Level：0=无高光，1=强高光 — 皮肤 0.2-0.3，布料 0.1-0.2
5. Sheen Weight：天鹅绒质感 — 布料可加 0.2-0.4
6. Coat Weight：清漆层 — 头发可加 0.2-0.4
确保所有参数在物理合理范围内，不要出现 metallic=1 且 roughness=0 的违反物理的组合。`,
    formatInstructions: "输出 JSON 格式：包含参数名、当前值、建议值、调整理由。",
  },
};

/**
 * 根据模型 ID 获取 Prompt 配置
 */
export function getModelPromptConfig(modelId: string): ModelPromptConfig {
  return MODEL_PROMPT_CONFIGS[modelId] || MODEL_PROMPT_CONFIGS["GLM-5.2"];
}

/**
 * 为脚本生成任务构建模型适配的 system prompt
 */
export function buildScriptSystemPrompt(modelId: string): string {
  const config = getModelPromptConfig(modelId);
  return config.systemPrompt;
}

/**
 * 为脚本生成任务构建模型适配的格式指令
 */
export function buildFormatInstructions(modelId: string): string {
  const config = getModelPromptConfig(modelId);
  return config.formatInstructions;
}

/**
 * 为脚本生成任务构建完整 prompt
 * 根据模型特点调整 prompt 结构和侧重点
 */
export function buildModelAdaptedScriptPrompt(
  modelId: string,
  basePrompt: string,
  referenceSnippets?: string
): string {
  const config = getModelPromptConfig(modelId);

  switch (config.strategy) {
    case "code_generation":
      // Kimi-K2.7: 强调代码框架和 API 参考
      return `${config.systemPrompt}

${basePrompt}

${referenceSnippets ? `\n## 参考代码片段（供参考，不限制创作）\n\n${referenceSnippets}` : ""}

${config.formatInstructions}`;

    case "debugging":
      // DeepSeek-V4-Pro: 强调错误分析
      return `${config.systemPrompt}

${basePrompt}

${config.formatInstructions}`;

    case "structured_json":
      // Doubao: 结构化输出
      return `${config.systemPrompt}

${basePrompt}

${config.formatInstructions}`;

    case "creative_english":
      // GLM-5.2: 创意 prompt
      return `${config.systemPrompt}

${basePrompt}

${config.formatInstructions}`;

    default:
      return `${basePrompt}\n\n${config.formatInstructions}`;
  }
}

/**
 * 为质量评估任务构建 prompt
 */
export function buildQualityAssessmentPrompt(
  modelId: string,
  referencePaths: string[],
  renderPaths: string[]
): string {
  const config = getModelPromptConfig(modelId);

  return `${config.systemPrompt}

参考图：
${referencePaths.map((p, i) => `  ${i + 1}. ${p}`).join("\n")}

渲染图：
${renderPaths.map((p, i) => `  ${i + 1}. ${p}`).join("\n")}

请输出 JSON 格式的评估结果：
{
  "scores": {
    "silhouette_match": 0-100,
    "proportion_accuracy": 0-100,
    "color_fidelity": 0-100,
    "detail_completeness": 0-100,
    "material_quality": 0-100,
    "overall": 0-100
  },
  "issues": [
    { "severity": "critical|major|minor", "category": "geometry|material|proportion|detail", "description": "...", "suggestion": "..." }
  ],
  "improvement_priority": ["..."],
  "pass_threshold": true/false
}

${config.formatInstructions}`;
}

/**
 * 为多视图生成任务构建 prompt
 */
export function buildMultiviewPrompt(
  modelId: string,
  viewType: "front" | "side" | "back",
  analysis: PhotoAnalysis,
  style: string
): string {
  const config = getModelPromptConfig(modelId);
  const isEnglish = config.strategy === "creative_english" || config.strategy === "image_generation";

  if (isEnglish) {
    // 英文 prompt（Doubao、GLM 图像生成）
    const viewDesc = viewType === "front" ? "front view, facing camera" : viewType === "side" ? "side profile view" : "back view";
    const hairDesc = analysis.hair ? `${analysis.hair.color} ${analysis.hair.style}` : "";
    const outfitDesc = analysis.outfit ? `${analysis.outfit.top}${analysis.outfit.bottom ? ", " + analysis.outfit.bottom : ""}` : "";

    return `A cute chibi (Q-version) character, ${viewDesc}, ${hairDesc}, wearing ${outfitDesc}, ${style} style, 3D render, solid white background, full body visible, front lighting, high quality, professional, masterpiece.`;
  } else {
    return `Q版角色${viewType === "front" ? "正面" : viewType === "side" ? "侧面" : "背面"}全身图，${style}风格，白色背景，高质量3D渲染。`;
  }
}

/**
 * 为纹理生成任务构建 prompt
 * 生成可投射到 3D 模型上的无缝纹理贴图
 */
export function buildTextureGenerationPrompt(
  modelId: string,
  analysis: PhotoAnalysis,
  part: "skin" | "hair" | "dress" | "accessory" | "trim"
): string {
  const config = getModelPromptConfig(modelId);

  const partPrompts: Record<string, string> = {
    skin: "seamless tileable skin texture, smooth even skin tone, subtle pore detail, diffuse/albedo map, flat even lighting, no shadows, no 3D perspective, orthographic top-down view, 1024x1024, professional texture asset for 3D character",
    hair: "seamless tileable hair texture, flowing strands pattern, [color] gradient, diffuse/albedo map, flat even lighting, no shadows, no 3D perspective, orthographic top-down view, 1024x1024, professional texture asset for 3D character",
    dress: "seamless tileable fabric texture, [pattern] pattern, soft cloth weave, diffuse/albedo map, flat even lighting, no shadows, no 3D perspective, orthographic top-down view, 1024x1024, professional texture asset for 3D character",
    accessory: "seamless tileable iridescent/metallic texture, shiny surface, diffuse/albedo map, flat even lighting, no shadows, no 3D perspective, orthographic top-down view, 1024x1024, professional texture asset for 3D character",
    trim: "seamless tileable lace/trim texture, white delicate lace pattern, semi-transparent, diffuse/albedo map, flat even lighting, no shadows, no 3D perspective, orthographic top-down view, 1024x1024, professional texture asset for 3D character",
  };

  // 根据角色特征定制 prompt
  let customPrompt = partPrompts[part] || partPrompts.dress;
  
  if (part === "hair" && analysis.hair) {
    customPrompt = customPrompt.replace("[color]", analysis.hair.color || "gradient");
  }
  if (part === "dress" && analysis.outfit) {
    const pattern = analysis.outfit.pattern || "star pattern";
    customPrompt = customPrompt.replace("[pattern]", pattern);
  }

  return `${config.systemPrompt}

Generate a texture map for: ${part} of a chibi character.
${customPrompt}

${config.formatInstructions}`;
}

/**
 * 为材质参数提取任务构建 prompt
 * GLM-5.2 分析 PhotoAnalysis 和纹理图，提取 PBR 材质参数
 */
export function buildMaterialExtractionPrompt(
  modelId: string,
  analysis: PhotoAnalysis,
  texturePaths: Record<string, string>
): string {
  const config = getModelPromptConfig(modelId);

  return `${config.systemPrompt}

角色特征：
${JSON.stringify(analysis, null, 2)}

纹理贴图路径：
${Object.entries(texturePaths).map(([k, v]) => `  ${k}: ${v}`).join("\n")}

请分析上述角色特征和纹理，输出每个部件的精确 PBR 材质参数 JSON：
{
  "skin": {
    "baseColor": "#HEXCODE",
    "baseColorRGBA": [R, G, B, A],
    "roughness": 0.0-1.0,
    "metallic": 0.0-1.0,
    "subsurface": 0.0-1.0,
    "specularIOR": 0.0-1.0
  },
  "hair": { ... },
  "dress": { ... },
  "accessory": { ... },
  "trim": { ... }
}

规则：
- 皮肤：roughness 0.3-0.5, metallic 0, subsurface 0.05-0.2
- 头发：roughness 0.2-0.4, 可加 coatWeight 0.2-0.4
- 布料：roughness 0.4-0.7, sheenWeight 0.2-0.4
- 金属/宝石：roughness 0.1-0.3, metallic 0.5-0.9
- 所有颜色从角色特征描述中提取，不要编造

${config.formatInstructions}`;
}