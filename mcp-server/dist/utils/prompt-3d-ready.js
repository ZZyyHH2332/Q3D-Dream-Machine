/**
 * 3D-Ready Prompt 优化器
 * 为 Hunyuan3D-2 / SF3D 等 3D 重建模型优化 2D 图像生成 prompt
 *
 * 核心原则：
 * - 3D 重建需要清晰轮廓、纯色背景、正面视角
 * - 避免遮挡、复杂姿态、透明元素
 * - 强调体积感和结构感
 */
// 3D-ready 增强后缀（追加到 2D prompt 末尾）
export const THREE_D_READY_SUFFIX = "3D model reference sheet style, front-facing view, T-pose or A-pose, " +
    "centered composition, full body visible from head to feet, " +
    "clean solid white background, no shadows on background, " +
    "clear silhouette, well-defined body structure, " +
    "consistent proportions, volumetric appearance, " +
    "studio lighting, even illumination, no harsh shadows";
// 负面 prompt（用于排除不利于 3D 重建的元素）
export const THREE_D_NEGATIVE_PROMPT = "side view, back view, three-quarter view, turned body, " +
    "crossed arms, hands covering face, hands behind back, " +
    "occluded body parts, transparent clothing, see-through, " +
    "complex background, multiple characters, text, watermark, " +
    "extreme perspective, foreshortening, dynamic pose, action pose, " +
    "floating elements, particles, sparkles, glow effects, " +
    "blurry, low quality, deformed, extra limbs, bad anatomy";
// 不同风格的 3D-ready 前缀
const STYLE_3D_PREFIX = {
    kawaii: "3D chibi character design, cute Q-version figurine, " +
        "big head small body proportion (head:body = 1:1.5), " +
        "round smooth surfaces, soft material appearance, ",
    guofeng: "3D Chinese style figurine, elegant Q-version character, " +
        "traditional costume with clear structure, " +
        "smooth ceramic-like surface, ",
    trendy: "3D collectible toy figure, blind box style, " +
        "high detail miniature sculpture, " +
        "glossy plastic material, sharp clean edges, ",
    simple: "3D minimalist character figure, clean geometric shapes, " +
        "smooth flat-shaded surface, " +
        "simple clean design, modern toy aesthetic, ",
};
/**
 * 将普通 2D prompt 转换为 3D-ready prompt
 * @param basePrompt 原始 2D prompt
 * @param style 风格名称
 * @param includeNegative 是否包含负面 prompt
 */
export function enhanceFor3D(basePrompt, style = "kawaii", includeNegative = true) {
    const prefix3D = STYLE_3D_PREFIX[style] || STYLE_3D_PREFIX.kawaii;
    // 组合：3D 前缀 + 原始 prompt + 3D 后缀
    const enhanced = `${prefix3D}${basePrompt}, ${THREE_D_READY_SUFFIX}`;
    return {
        prompt: enhanced,
        negative: includeNegative ? THREE_D_NEGATIVE_PROMPT : null,
    };
}
/**
 * 从 PhotoAnalysis 直接构建 3D-ready prompt
 */
export function build3DReadyPrompt(style, analysis, customPrompt) {
    const descText = [
        analysis.gender && `gender: ${analysis.gender}`,
        analysis.ageRange && `age: ${analysis.ageRange}`,
        analysis.hairStyle && `hair: ${analysis.hairStyle}`,
        analysis.facialFeatures && `face: ${analysis.facialFeatures}`,
        analysis.clothing && `clothing: ${analysis.clothing}`,
        analysis.expression && `expression: ${analysis.expression}`,
        analysis.overallVibe && `vibe: ${analysis.overallVibe}`,
    ]
        .filter(Boolean)
        .join(", ");
    const basePrompt = customPrompt
        ? `${customPrompt}, ${descText}`
        : descText;
    return enhanceFor3D(basePrompt, style, true);
}
//# sourceMappingURL=prompt-3d-ready.js.map