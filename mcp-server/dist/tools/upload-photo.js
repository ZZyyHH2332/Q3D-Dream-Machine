import path from "path";
import fs from "fs";
import { config } from "../config.js";
import { copyFile, generateSessionId, getSessionPath, } from "../utils/file.js";
import { addOrUpdateWork } from "../utils/works-index.js";
export function registerUploadPhoto(server) {
    server.registerTool("q3d_upload_photo", "保存用户上传的照片到项目目录，为后续生成做准备", {
        imagePath: {
            type: "string",
            description: "用户上传照片的绝对路径",
        },
        style: {
            type: "string",
            description: "风格选择：kawaii（软萌大头）/ guofeng（国风Q版）/ trendy（潮玩手办）/ simple（简约卡通）",
            enum: ["kawaii", "guofeng", "trendy", "simple"],
        },
    }, async (args) => {
        try {
            const { imagePath, style = "kawaii" } = args;
            if (!imagePath || typeof imagePath !== "string") {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                error: {
                                    code: "UPLOAD_INVALID_PATH",
                                    message: "图片路径不能为空",
                                    suggestion: "请提供有效的图片文件绝对路径",
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
            const ext = path.extname(imagePath).toLowerCase();
            const allowedExts = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
            if (!allowedExts.includes(ext)) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                error: {
                                    code: "UPLOAD_INVALID_FORMAT",
                                    message: `不支持的图片格式: ${ext}`,
                                    suggestion: `请上传以下格式之一: ${allowedExts.join(", ")}`,
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
            // File size check (4MB limit)
            const stats = fs.statSync(imagePath);
            const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB
            if (stats.size > MAX_FILE_SIZE) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                error: {
                                    code: "UPLOAD_FILE_TOO_LARGE",
                                    message: `图片文件过大 (${(stats.size / 1024 / 1024).toFixed(1)}MB)，超过 4MB 限制`,
                                    suggestion: "请压缩图片后重新上传，或使用更小尺寸的照片",
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
            const sessionId = generateSessionId();
            const sessionDir = getSessionPath(config.uploadsDir, sessionId);
            const destPath = path.join(sessionDir, `original${ext}`);
            copyFile(imagePath, destPath);
            // Update works index
            addOrUpdateWork(sessionId, {
                status: "uploaded",
                style: style,
                styleName: style === "kawaii"
                    ? "软萌大头"
                    : style === "guofeng"
                        ? "国风Q版"
                        : style === "trendy"
                            ? "潮玩手办"
                            : "简约卡通",
                originalPath: destPath,
            });
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            uploadId: sessionId,
                            savedPath: destPath,
                            style,
                            message: `照片已保存，Session ID: ${sessionId}`,
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
                                code: "UPLOAD_FAILED",
                                message: error.message || "照片保存失败",
                                suggestion: "请检查文件路径是否正确，或尝试重新上传",
                            },
                        }),
                    },
                ],
                isError: true,
            };
        }
    });
}
//# sourceMappingURL=upload-photo.js.map