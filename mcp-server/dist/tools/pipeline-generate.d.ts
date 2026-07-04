/**
 * q3d_pipeline_generate - Pipeline 编排器
 *
 * 一站式 3D 建模 Pipeline，自动编排各阶段：
 * 照片分析 → 多视图生成 → 脚本生成 → 脚本执行 → 质量评估 → 智能优化
 *
 * 与单独调用工具的区别：
 * 1. 自动推进 Pipeline 阶段
 * 2. 每个阶段自动选择最优模型
 * 3. 质量不达标自动 refine（最多 3 次）
 * 4. 状态追踪和进度记录
 */
export declare function registerPipelineGenerate(server: any): void;
//# sourceMappingURL=pipeline-generate.d.ts.map