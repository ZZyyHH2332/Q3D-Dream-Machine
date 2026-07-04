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
export declare enum ModelTask {
    VISION_ANALYSIS = "vision_analysis",
    IMAGE_GENERATION = "image_generation",
    PROMPT_OPTIMIZATION = "prompt_optimization",
    SCRIPT_GENERATION = "script_generation",
    SCRIPT_REFINEMENT = "script_refinement",
    QUALITY_ASSESSMENT = "quality_assessment",
    MULTIVIEW_GENERATION = "multiview_generation"
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
/**
 * 根据任务类型获取推荐模型
 */
export declare function routeModel(task: ModelTask): ModelRoute;
/**
 * 根据输入复杂度动态调整模型选择
 * - 简单角色（无配饰、简单发型）→ 可降级到 Turbo/Flash 加速
 * - 复杂角色（多配饰、复杂发型、特殊材质）→ 保持 Pro 模型
 */
export declare function routeModelByComplexity(task: ModelTask, analysis?: PhotoAnalysis | null): ModelRoute;
/**
 * 获取所有支持的任务类型和对应模型
 * 供 Pipeline 编排器使用
 */
export declare function getAllTaskRoutes(): Record<string, ModelRoute>;
//# sourceMappingURL=model-router.d.ts.map