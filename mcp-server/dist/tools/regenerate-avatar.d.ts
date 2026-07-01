/**
 * q3d_regenerate_avatar
 * 形象重新生成工具：基于已有作品换风格、换种子
 *
 * 注意：由于 TRAE Native 模式下生成是由 TRAE Agent 通过 GenerateImage 完成的，
 * 本工具主要做：1）查找原作品 2）复制并更新元数据 3）记录操作历史
 * 实际的重新生成由 TRAE Agent 调用 GenerateImage 后再用 q3d_save_avatar 保存
 */
export declare function registerRegenerateAvatar(server: any): void;
//# sourceMappingURL=regenerate-avatar.d.ts.map