import path from "path";
import { config } from "../config.js";
import { copyFile, generateSessionId, getSessionPath, } from "../utils/file.js";
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
            const sessionId = generateSessionId();
            const sessionDir = getSessionPath(config.uploadsDir, sessionId);
            const destPath = path.join(sessionDir, `original${ext}`);
            copyFile(imagePath, destPath);
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