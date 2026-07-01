import path from "path";
import fs from "fs";
import { config } from "../config.js";
import { getSessionPath, findLatestAvatar, copyFile } from "../utils/file.js";
import { addOrUpdateWork, getWorkById } from "../utils/works-index.js";
/**
 * q3d_regenerate_avatar
 * 形象重新生成工具：基于已有作品换风格、换种子
 *
 * 注意：由于 TRAE Native 模式下生成是由 TRAE Agent 通过 GenerateImage 完成的，
 * 本工具主要做：1）查找原作品 2）复制并更新元数据 3）记录操作历史
 * 实际的重新生成由 TRAE Agent 调用 GenerateImage 后再用 q3d_save_avatar 保存
 */
export function registerRegenerateAvatar(server) {
    server.registerTool("q3d_regenerate_avatar", "形象重新生成 - 基于已有作品换风格、记录重新生成历史（生成操作由 TRAE 的 GenerateImage 完成）", {
        workId: {
            type: "string",
            description: "源作品 ID（sessionId）",
        },
        newStyle: {
            type: "string",
            description: "新风格：kawaii（软萌大头）/ guofeng（国风Q版）/ trendy（潮玩手办）/ simple（简约卡通）",
        },
        newWorkId: {
            type: "string",
            description: "新作品的 sessionId（可选，默认生成新的）",
        },
        reason: {
            type: "string",
            description: "重新生成原因：style_change（换风格）/ new_seed（换种子）/ not_satisfied（不满意）/ other（其他）",
        },
    }, async (args) => {
        try {
            let { workId, newStyle, newWorkId, reason = "new_seed" } = args;
            // 如果没有提供 workId，找最新的作品
            if (!workId) {
                const latestAvatar = findLatestAvatar(config.outputDir);
                if (latestAvatar) {
                    const sessionDir = path.dirname(latestAvatar);
                    workId = path.basename(sessionDir);
                }
            }
            if (!workId) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                error: {
                                    code: "NO_SOURCE_WORK",
                                    message: "未找到源作品",
                                    suggestion: "请提供 workId，或先生成一个形象",
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
            // 查找源作品
            const sourceWork = getWorkById(workId);
            if (!sourceWork) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                error: {
                                    code: "SOURCE_NOT_FOUND",
                                    message: `源作品不存在：${workId}`,
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
            // 验证新风格
            const validStyles = ["kawaii", "guofeng", "trendy", "simple"];
            const style = newStyle || sourceWork.style;
            if (newStyle && !validStyles.includes(newStyle)) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                error: {
                                    code: "INVALID_STYLE",
                                    message: `无效风格：${newStyle}`,
                                    suggestion: "可选风格：kawaii / guofeng / trendy / simple",
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
            const styleNames = {
                kawaii: "软萌大头",
                guofeng: "国风Q版",
                trendy: "潮玩手办",
                simple: "简约卡通",
            };
            const reasonNames = {
                style_change: "换风格",
                new_seed: "换种子",
                not_satisfied: "不满意",
                other: "其他",
            };
            // 生成新的 workId
            const finalNewWorkId = newWorkId || `${workId}_regen_${Date.now()}`;
            // 准备新会话目录
            const newOutputDir = getSessionPath(config.outputDir, finalNewWorkId);
            // 如果有源形象图，复制一份作为参考（实际新图由 GenerateImage 生成后用 save-avatar 保存）
            let sourceAvatarPath = null;
            if (sourceWork.avatarPath) {
                // 转换为绝对路径
                const projectRoot = path.join(config.outputDir, "..");
                sourceAvatarPath = path.join(projectRoot, sourceWork.avatarPath);
                if (fs.existsSync(sourceAvatarPath)) {
                    // 复制源图到新会话目录，命名为 source.png 做参考
                    const refPath = path.join(newOutputDir, "source.png");
                    copyFile(sourceAvatarPath, refPath);
                }
            }
            // 记录到作品索引（状态为 uploaded，表示等待生成）
            addOrUpdateWork(finalNewWorkId, {
                status: "uploaded",
                style: style,
                styleName: styleNames[style],
                originalPath: sourceAvatarPath,
            });
            // 保存重新生成元数据
            const regenInfo = {
                sourceWorkId: workId,
                newWorkId: finalNewWorkId,
                oldStyle: sourceWork.style,
                newStyle: style,
                reason,
                reasonName: reasonNames[reason] || reason,
                regeneratedAt: new Date().toISOString(),
                note: "请使用 TRAE 的 GenerateImage 生成新形象，然后调用 q3d_save_avatar 保存",
            };
            const regenPath = path.join(newOutputDir, "regenerate-info.json");
            fs.writeFileSync(regenPath, JSON.stringify(regenInfo, null, 2), "utf-8");
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            sourceWorkId: workId,
                            newWorkId: finalNewWorkId,
                            oldStyle: sourceWork.style,
                            newStyle: style,
                            newStyleName: styleNames[style],
                            reason,
                            reasonName: reasonNames[reason] || reason,
                            nextStep: "请使用 GenerateImage 工具生成新形象（使用新风格的 prompt），然后调用 q3d_save_avatar 保存到新的 sessionId",
                            message: `已准备重新生成：${sourceWork.style} → ${style}（${reasonNames[reason] || reason}）`,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: false,
                            error: {
                                code: "REGENERATE_FAILED",
                                message: error.message || "重新生成失败",
                            },
                        }),
                    },
                ],
                isError: true,
            };
        }
    });
}
//# sourceMappingURL=regenerate-avatar.js.map