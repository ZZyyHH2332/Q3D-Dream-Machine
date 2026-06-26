import path from "path";
import fs from "fs";
import { config } from "../config.js";
import { getSessionPath, openInBrowser, findLatestAvatar, } from "../utils/file.js";
export function registerCreate3DPreview(server) {
    server.registerTool("q3d_create_3d_preview", "基于生成的 Q 版形象创建 Three.js 3D 预览页面", {
        avatarPath: {
            type: "string",
            description: "生成的 Q 版形象图片路径（可选，默认使用最近一次生成）",
        },
    }, async (args) => {
        try {
            let avatarPath = args.avatarPath;
            // If no avatar path provided, find the latest generated one
            if (!avatarPath) {
                avatarPath = findLatestAvatar(config.outputDir) || "";
            }
            if (!avatarPath || !fs.existsSync(avatarPath)) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                error: {
                                    code: "PREVIEW_AVATAR_NOT_FOUND",
                                    message: "未找到生成的 Q 版形象图片",
                                    suggestion: "请先调用 q3d_generate_avatar 生成形象，或提供 avatarPath 参数",
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
            // Determine session ID from avatar path
            const avatarDir = path.dirname(avatarPath);
            const sessionId = path.basename(avatarDir);
            // Read template
            const templatePath = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..", "preview-template", "preview-3d.html");
            if (!fs.existsSync(templatePath)) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                error: {
                                    code: "PREVIEW_TEMPLATE_MISSING",
                                    message: "3D 预览模板文件不存在",
                                    suggestion: "请检查 preview-template/preview-3d.html 是否存在",
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
            let template = fs.readFileSync(templatePath, "utf-8");
            // Replace placeholder with absolute path (file protocol)
            const fileUrl = "file://" + avatarPath.replace(/\\/g, "/");
            template = template.replace(/\{\{AVATAR_PATH\}\}/g, fileUrl);
            // Write output
            const outputDir = getSessionPath(config.outputDir, sessionId);
            const previewPath = path.join(outputDir, "preview-3d.html");
            fs.writeFileSync(previewPath, template, "utf-8");
            // Open in browser
            await openInBrowser(previewPath);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            previewPath,
                            sessionId,
                            message: `3D 预览页面已生成并打开：${previewPath}`,
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
                                code: "PREVIEW_CREATE_FAILED",
                                message: error.message || "3D 预览创建失败",
                                suggestion: "请检查模板文件和文件权限",
                            },
                        }),
                    },
                ],
                isError: true,
            };
        }
    });
}
//# sourceMappingURL=create-3d-preview.js.map