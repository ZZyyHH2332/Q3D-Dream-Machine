/**
 * q3d_assess_model - 3D 模型质量评估工具
 *
 * 工作流程：
 * 1. 检查 GLB 文件是否存在
 * 2. 返回 NEED_QUALITY_ASSESSMENT 信号，附带参考图和 GLB 渲染图路径
 * 3. IDE 使用 Qwen3.7-Plus 模型进行多模态对比分析
 * 4. 回传评估结果，低于 70 分自动触发 refine
 */
export declare function registerAssessModelQuality(server: any): void;
//# sourceMappingURL=assess-model-quality.d.ts.map