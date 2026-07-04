/**
 * 模型路由器 — TRAE Auto Mode 模型智能路由决策引擎
 *
 * 根据任务类型、输入特征自动选择最优 TRAE Auto Mode 模型。
 * 设计原则：
 * - Doubao-Seed-2.1-Turbo: 视觉理解+图像生成（Pro 不可用时最佳选择）
 * - GLM-5.2: 多模态+代码双向能力，适合需要理解图片+生成代码的任务
 * - DeepSeek-V4-Pro: 推理能力最强，适合复杂逻辑、调试、错误分析
 * - Kimi-K2.7-Code: 代码专精+长上下文，适合生成完整大型脚本
 * - Qwen3.7-Plus: 多模态空间理解，适合需要空间推理的任务
 * - MiniMax-M3: 工程能力，适合参数调优、数值优化
 */

import { PhotoAnalysis } from "./types.js";

/** 模型任务类型 */
export enum ModelTask {
  VISION_ANALYSIS = "vision_analysis",
  IMAGE_GENERATION = "image_generation",
  PROMPT_OPTIMIZATION = "prompt_optimization",
  SCRIPT_GENERATION = "script_generation",
  SCRIPT_REFINEMENT = "script_refinement",
  QUALITY_ASSESSMENT = "quality_assessment",
  MULTIVIEW_GENERATION = "multiview_generation",
}

/** 模型路由结果 */
export interface ModelRoute {
  modelId: string;
  modelName: string;
  reasoning: string;
  promptStrategy: string;
  fallbackModelId?: string;
  fallbackModelName?: string;
}

/** 复杂度等级 */
type Complexity = "low" | "medium" | "high";

/**
 * 模型路由表
 */
const MODEL_ROUTING_TABLE: Record<ModelTask, ModelRoute> = {
  [ModelTask.VISION_ANALYSIS]: {
    modelId: "Qwen3.7-Plus",
    modelName: "通义千问 3.7 Plus",
    reasoning: "多模态视觉理解强，Pro 不可用时最佳替代",
    promptStrategy: "structured_json",
    fallbackModelId: "GLM-5.2",
    fallbackModelName: "智谱 GLM 5.2",
  },
  [ModelTask.IMAGE_GENERATION]: {
    modelId: "Doubao-Seed-2.1-Turbo",
    modelName: "豆包 Seed 2.1 Turbo",
    reasoning: "图像生成质量好，Pro 不可用时最佳替代",
    promptStrategy: "image_generation",
    fallbackModelId: "GLM-5.2",
    fallbackModelName: "智谱 GLM 5.2",
  },
  [ModelTask.PROMPT_OPTIMIZATION]: {
    modelId: "GLM-5.2",
    modelName: "智谱 GLM 5.2",
    reasoning: "多模态理解+prompt 工程能力强，能生成高质量图像 prompt",
    promptStrategy: "creative_english",
    fallbackModelId: "DeepSeek-V4-Pro",
    fallbackModelName: "DeepSeek V4 Pro",
  },
  [ModelTask.SCRIPT_GENERATION]: {
    modelId: "Kimi-K2.7",
    modelName: "Kimi K2.7",
    reasoning: "代码专精+长上下文(128K)，适合生成完整 Blender Python 脚本",
    promptStrategy: "code_generation",
    fallbackModelId: "GLM-5.2",
    fallbackModelName: "智谱 GLM 5.2",
  },
  [ModelTask.SCRIPT_REFINEMENT]: {
    modelId: "DeepSeek-V4-Pro",
    modelName: "DeepSeek V4 Pro",
    reasoning: "推理能力最强，适合分析错误日志并精准定位修复",
    promptStrategy: "debugging",
    fallbackModelId: "Kimi-K2.7",
    fallbackModelName: "Kimi K2.7",
  },
  [ModelTask.QUALITY_ASSESSMENT]: {
    modelId: "Qwen3.7-Plus",
    modelName: "通义千问 3.7 Plus",
    reasoning: "多模态空间理解好，适合对比 3D 渲染图与参考图",
    promptStrategy: "comparative_analysis",
    fallbackModelId: "MiniMax-M3",
    fallbackModelName: "MiniMax M3",
  },
  [ModelTask.MULTIVIEW_GENERATION]: {
    modelId: "Doubao-Seed-2.1-Turbo",
    modelName: "豆包 Seed 2.1 Turbo",
    reasoning: "多视图一致性好，Pro 不可用时最佳替代",
    promptStrategy: "multiview",
    fallbackModelId: "GLM-5.2",
    fallbackModelName: "智谱 GLM 5.2",
  },
};

/**
 * 根据任务类型获取推荐模型
 */
export function routeModel(task: ModelTask): ModelRoute {
  return { ...MODEL_ROUTING_TABLE[task] };
}

/**
 * 根据输入复杂度动态调整模型选择
 * - 简单角色（无配饰、简单发型）→ 可降级到 Turbo/Flash 加速
 * - 复杂角色（多配饰、复杂发型、特殊材质）→ 保持 Pro 模型
 */
export function routeModelByComplexity(
  task: ModelTask,
  analysis?: PhotoAnalysis | null
): ModelRoute {
  const base = MODEL_ROUTING_TABLE[task];
  const complexity = estimateComplexity(analysis);

  if (complexity === "low" && base.fallbackModelId) {
    return {
      ...base,
      modelId: base.fallbackModelId,
      modelName: base.fallbackModelName || base.fallbackModelId,
      reasoning: `简单角色（复杂度: ${complexity}），降级到快速模型`,
    };
  }
  return { ...base, reasoning: `${base.reasoning}（复杂度: ${complexity}）` };
}

/**
 * 估计角色复杂度
 */
function estimateComplexity(analysis?: PhotoAnalysis | null): Complexity {
  if (!analysis) return "medium";

  let score = 0;

  // 配饰数量
  const accessoryCount = analysis.accessories?.length || 0;
  score += accessoryCount * 1;

  // 发型复杂度
  const hairDetails = analysis.hair?.details || "";
  if (hairDetails.length > 30) score += 2;
  else if (hairDetails.length > 15) score += 1;

  // 服装复杂度
  if (analysis.outfit?.outerwear) score += 1;
  if (analysis.outfit?.material) score += 1;

  // 特殊特征
  if (analysis.special_features?.length) score += analysis.special_features.length * 0.5;

  if (score >= 4) return "high";
  if (score >= 2) return "medium";
  return "low";
}

/**
 * 获取所有支持的任务类型和对应模型
 * 供 Pipeline 编排器使用
 */
export function getAllTaskRoutes(): Record<string, ModelRoute> {
  const result: Record<string, ModelRoute> = {};
  for (const [task, route] of Object.entries(MODEL_ROUTING_TABLE)) {
    result[task] = { ...route };
  }
  return result;
}