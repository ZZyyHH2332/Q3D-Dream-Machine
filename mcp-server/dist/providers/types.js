/**
 * Provider 类型定义
 * Q3D AI 能力统一接口，支持多种实现（TRAE Native / External API / Mock）
 */
/**
 * TRAE Native 模式下的协作信号
 * 当 MCP Server 无法直接执行 AI 能力时，返回这些信号给 TRAE Agent，
 * 由 TRAE Agent 完成后通过参数回传结果。
 */
export var TraeCollabSignal;
(function (TraeCollabSignal) {
    /** 需要 Vision 分析照片，TRAE Agent 应自行分析后传入 photoAnalysis 参数 */
    TraeCollabSignal["NEED_VISION_ANALYSIS"] = "NEED_VISION_ANALYSIS";
    /** 需要上传照片 */
    TraeCollabSignal["NEED_PHOTO_UPLOAD"] = "NEED_PHOTO_UPLOAD";
    /** 需要生成图像，TRAE Agent 应调用 GenerateImage 后传入 generatedImagePath 参数 */
    TraeCollabSignal["NEED_IMAGE_GENERATION"] = "NEED_IMAGE_GENERATION";
    /** 需要对话补全，TRAE Agent 应自行生成回复 */
    TraeCollabSignal["NEED_CHAT_COMPLETION"] = "NEED_CHAT_COMPLETION";
    /** 需要 Prompt 优化，TRAE Agent 应使用指定模型优化图像生成 prompt */
    TraeCollabSignal["NEED_PROMPT_OPTIMIZATION"] = "NEED_PROMPT_OPTIMIZATION";
    /** 需要生成多视图图像（front/side/back），TRAE Agent 应调用 GenerateImage 3 次后传入 generatedImagePaths 参数 */
    TraeCollabSignal["NEED_MULTIVIEW_GENERATION"] = "NEED_MULTIVIEW_GENERATION";
    /** 需要生成 Blender Python 脚本，TRAE Agent 应使用文本模型生成脚本后传入 scriptPath 参数 */
    TraeCollabSignal["NEED_SCRIPT_GENERATION"] = "NEED_SCRIPT_GENERATION";
    /** 批量多视图 Pipeline：一次性完成 Vision 分析 + 三视图生成 */
    TraeCollabSignal["NEED_MULTIVIEW_PIPELINE"] = "NEED_MULTIVIEW_PIPELINE";
    /** 批量脚本 Pipeline：一次性完成脚本生成 + 模型选择 */
    TraeCollabSignal["NEED_SCRIPT_PIPELINE"] = "NEED_SCRIPT_PIPELINE";
    /** 需要质量评估：对比 GLB 渲染图与参考图，给出评分和改进建议 */
    TraeCollabSignal["NEED_QUALITY_ASSESSMENT"] = "NEED_QUALITY_ASSESSMENT";
})(TraeCollabSignal || (TraeCollabSignal = {}));
//# sourceMappingURL=types.js.map