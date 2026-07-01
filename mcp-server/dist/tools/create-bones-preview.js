import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { config } from "../config.js";
import { getSessionPath, openInBrowser, findLatestAvatar, } from "../utils/file.js";
import { addOrUpdateWork } from "../utils/works-index.js";
/**
 * q3d_create_bones_preview
 * 创建带骨骼动画的 3D 预览页面（9 种动画：7 种心情 + 攀爬 + 倒挂）
 * 基于 preview-template/preview-3d.html + character-bones.js
 */
export function registerCreateBonesPreview(server) {
    server.registerTool("q3d_create_bones_preview", "创建带骨骼动画的 3D 预览页面（支持 9 种动画：7 种心情 + 攀爬 + 倒挂爬行）", {
        avatarPath: {
            type: "string",
            description: "Q 版形象图片路径（可选，默认使用最近一次生成）",
        },
        sessionId: {
            type: "string",
            description: "会话 ID（可选）",
        },
        mood: {
            type: "string",
            description: "初始心情/动画：idle(平静) happy(开心) excited(兴奋) sleeping(困倦) curious(好奇) sad(难过) love(喜爱) climbing(攀爬) crawling_upside(倒挂)",
        },
        autoRotate: {
            type: "boolean",
            description: "是否自动旋转预览（默认 true）",
        },
        openInBrowser: {
            type: "boolean",
            description: "是否自动打开浏览器（默认 true）",
        },
    }, async (args) => {
        try {
            let avatarPath = args.avatarPath;
            let sessionId = args.sessionId;
            const mood = args.mood || "idle";
            const autoRotate = args.autoRotate !== false;
            const shouldOpen = args.openInBrowser !== false;
            // Session-scoped avatar lookup
            if (!avatarPath && sessionId) {
                const sessionDir = path.join(config.outputDir, sessionId);
                const candidatePath = path.join(sessionDir, "avatar.png");
                if (fs.existsSync(candidatePath)) {
                    avatarPath = candidatePath;
                }
            }
            // Fallback: global search
            if (!avatarPath && !sessionId) {
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
                                    code: "BONES_AVATAR_NOT_FOUND",
                                    message: "未找到 Q 版形象图片",
                                    suggestion: "请先调用 q3d_generate_avatar 生成形象，或提供 avatarPath 参数",
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
            // Determine session ID from avatar path
            if (!sessionId) {
                const avatarDir = path.dirname(avatarPath);
                sessionId = path.basename(avatarDir);
            }
            const __dirname = path.dirname(fileURLToPath(import.meta.url));
            const templateDir = path.join(__dirname, "..", "..", "..", "preview-template");
            const templatePath = path.join(templateDir, "preview-3d.html");
            const bonesJsPath = path.join(templateDir, "js", "character-bones.js");
            if (!fs.existsSync(templatePath)) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                error: {
                                    code: "BONES_TEMPLATE_MISSING",
                                    message: "3D 预览模板文件不存在",
                                    suggestion: "请检查 preview-template/preview-3d.html 是否存在",
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
            // Read template
            let template = fs.readFileSync(templatePath, "utf-8");
            // Replace avatar path
            const fileUrl = "file://" + avatarPath.replace(/\\/g, "/");
            template = template.replace(/\{\{AVATAR_PATH\}\}/g, fileUrl);
            // Replace GLB model placeholder
            const outputDir = getSessionPath(config.outputDir, sessionId);
            const glbPath = path.join(outputDir, "model.glb");
            if (fs.existsSync(glbPath)) {
                const glbFileUrl = "file://" + glbPath.replace(/\\/g, "/");
                template = template.replace(/\{\{GLB_PATH\}\}/g, glbFileUrl);
            }
            else {
                template = template.replace(/\{\{GLB_PATH\}\}/g, "");
            }
            // Inject bones mode flag and initial mood via URL params in template
            // We'll add a script that sets the initial mood from URL params
            // The template already reads mood from URLSearchParams
            // Write output HTML
            const previewPath = path.join(outputDir, "preview-bones.html");
            fs.writeFileSync(previewPath, template, "utf-8");
            // Copy character-bones.js to session dir (for offline use)
            const jsOutputDir = path.join(outputDir, "js");
            if (!fs.existsSync(jsOutputDir)) {
                fs.mkdirSync(jsOutputDir, { recursive: true });
            }
            const bonesJsOutput = path.join(jsOutputDir, "character-bones.js");
            if (fs.existsSync(bonesJsPath)) {
                fs.copyFileSync(bonesJsPath, bonesJsOutput);
            }
            // Update works index
            addOrUpdateWork(sessionId, {
                status: "bones_preview_created",
                bonesPreviewPath: previewPath,
                initialMood: mood,
            });
            // Build preview URL with mood param
            const previewUrl = `file://${previewPath.replace(/\\/g, "/")}?mood=${encodeURIComponent(mood)}&autoRotate=${autoRotate}`;
            // Open in browser
            if (shouldOpen) {
                await openInBrowser(previewPath);
            }
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            previewPath,
                            previewUrl,
                            sessionId,
                            initialMood: mood,
                            availableAnimations: [
                                { id: "idle", name: "平静", desc: "缓慢呼吸 + 轻微摇摆" },
                                { id: "happy", name: "开心", desc: "弹跳 + 手臂挥动" },
                                { id: "excited", name: "兴奋", desc: "跳跃 + 全身缩放 + 高举双手" },
                                { id: "sleeping", name: "困倦", desc: "慢速呼吸 + 低头 + 放松" },
                                { id: "curious", name: "好奇", desc: "歪头 + 前倾 + 手臂微抬" },
                                { id: "sad", name: "难过", desc: "下垂 + 颤抖 + 低头含胸" },
                                { id: "love", name: "喜爱", desc: "心跳脉冲 + 双手抱胸" },
                                { id: "climbing", name: "攀爬", desc: "向上攀爬姿态（借鉴 Shimeji）" },
                                { id: "crawling_upside", name: "倒挂", desc: "顶部倒挂爬行（借鉴 Shimeji）" },
                            ],
                            message: `骨骼动画 3D 预览已生成，初始心情：${mood}`,
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
                                code: "BONES_PREVIEW_FAILED",
                                message: error.message || "骨骼动画预览创建失败",
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
//# sourceMappingURL=create-bones-preview.js.map