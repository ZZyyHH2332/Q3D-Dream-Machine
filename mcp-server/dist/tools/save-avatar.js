/**
 * q3d_save_avatar 工具
 *
 * 用途：TRAE Agent 使用 GenerateImage 工具生成头像图片后，
 * 调用此工具将图片保存到正确的会话目录，并更新作品索引。
 *
 * 这是 TRAE Native 协作模式的关键工具之一。
 */
import path from "path";
import fs from "fs";
import { config } from "../config.js";
import { getSessionPath, writeJsonFile, copyFile } from "../utils/file.js";
import { addOrUpdateWork } from "../utils/works-index.js";
const STYLE_CONFIG = {
    kawaii: { name: "kawaii", label: "软萌大头" },
    guofeng: { name: "guofeng", label: "国风Q版" },
    trendy: { name: "trendy", label: "潮玩手办" },
    simple: { name: "simple", label: "简约卡通" },
};
export function registerSaveAvatar(server) {
    server.registerTool("q3d_save_avatar", "保存已生成的 Q 版头像图片到会话目录。" +
        "【TRAE 模式专用】当你使用 GenerateImage 工具生成头像后，" +
        "调用此工具将图片保存到 Q3D 作品系统中，以便后续生成 3D 模型、领养宠物等操作。", {
        uploadId: {
            type: "string",
            description: "上传照片时返回的 Session ID",
        },
        imagePath: {
            type: "string",
            description: "已生成的头像图片的本地完整路径",
        },
        style: {
            type: "string",
            description: "风格选择",
            enum: ["kawaii", "guofeng", "trendy", "simple"],
        },
        revisedPrompt: {
            type: "string",
            description: "【可选】实际用于生成图片的 prompt",
        },
        photoAnalysis: {
            type: "string",
            description: "【可选】照片人物特征分析结果的 JSON 字符串。" +
                "包含字段：gender, ageRange, hairStyle, facialFeatures, clothing, expression, overallVibe",
        },
    }, async (args) => {
        try {
            const { uploadId, imagePath, style = "kawaii", revisedPrompt, photoAnalysis: photoAnalysisStr, } = args;
            // 验证图片文件存在
            if (!fs.existsSync(imagePath)) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                error: {
                                    code: "IMAGE_NOT_FOUND",
                                    message: `图片文件不存在: ${imagePath}`,
                                    suggestion: "请检查图片路径是否正确，确保文件已生成",
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
            // 验证上传会话存在
            const uploadDir = path.join(config.uploadsDir, uploadId);
            if (!fs.existsSync(uploadDir)) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                error: {
                                    code: "UPLOAD_NOT_FOUND",
                                    message: `未找到上传记录: ${uploadId}`,
                                    suggestion: "请先调用 q3d_upload_photo 上传照片",
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
            // 查找原始照片路径
            const uploadedFiles = fs
                .readdirSync(uploadDir)
                .filter((f) => f.startsWith("original."));
            const originalPath = uploadedFiles.length > 0
                ? path.join(uploadDir, uploadedFiles[0])
                : "";
            // 解析 photoAnalysis
            let photoAnalysisObj = null;
            if (photoAnalysisStr) {
                try {
                    photoAnalysisObj = JSON.parse(photoAnalysisStr);
                }
                catch {
                    // 解析失败就不保存
                }
            }
            // 保存图片到输出目录
            const outputDir = getSessionPath(config.outputDir, uploadId);
            const avatarPath = path.join(outputDir, "avatar.png");
            copyFile(imagePath, avatarPath);
            // 保存 metadata
            const metadata = {
                uploadId,
                originalPath,
                avatarPath,
                style,
                customPrompt: null,
                revisedPrompt: revisedPrompt || style,
                photoAnalysis: photoAnalysisObj,
                provider: "trae-native",
                generatedAt: new Date().toISOString(),
            };
            const metadataPath = path.join(outputDir, "metadata.json");
            writeJsonFile(metadataPath, metadata);
            // 更新作品索引
            addOrUpdateWork(uploadId, {
                status: "avatar_generated",
                style: style,
                styleName: STYLE_CONFIG[style]?.label || "未知风格",
                avatarPath,
            });
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            avatarPath,
                            style,
                            metadataPath,
                            provider: "trae-native",
                            message: `Q 版头像已保存！路径: ${avatarPath}`,
                            nextSteps: [
                                "调用 q3d_create_3d_preview 生成 3D 预览",
                                "调用 q3d_generate_3d_model 生成 3D 模型",
                                "调用 q3d_spawn_pet 领养桌面宠物",
                            ],
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
                                code: "SAVE_AVATAR_FAILED",
                                message: error.message || "保存头像失败",
                                suggestion: "请检查图片路径和文件权限",
                            },
                        }),
                    },
                ],
                isError: true,
            };
        }
    });
}
//# sourceMappingURL=save-avatar.js.map