/**
 * 3D-Ready Prompt 优化器
 * 为 Hunyuan3D-2 / SF3D 等 3D 重建模型优化 2D 图像生成 prompt
 *
 * 核心原则：
 * - 3D 重建需要清晰轮廓、纯色背景、正面视角
 * - 避免遮挡、复杂姿态、透明元素
 * - 强调体积感和结构感
 */
export declare const THREE_D_READY_SUFFIX: string;
export declare const THREE_D_NEGATIVE_PROMPT: string;
/**
 * 将普通 2D prompt 转换为 3D-ready prompt
 * @param basePrompt 原始 2D prompt
 * @param style 风格名称
 * @param includeNegative 是否包含负面 prompt
 */
export declare function enhanceFor3D(basePrompt: string, style?: string, includeNegative?: boolean): {
    prompt: string;
    negative: string | null;
};
/**
 * 从 PhotoAnalysis 直接构建 3D-ready prompt
 */
export declare function build3DReadyPrompt(style: string, analysis: {
    gender: string;
    ageRange: string;
    hairStyle: string;
    facialFeatures: string;
    clothing: string;
    expression: string;
    overallVibe: string;
}, customPrompt?: string): {
    prompt: string;
    negative: string | null;
};
//# sourceMappingURL=prompt-3d-ready.d.ts.map