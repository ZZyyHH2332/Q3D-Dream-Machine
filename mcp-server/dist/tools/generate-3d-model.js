import path from "path";
import fs from "fs";
import { config } from "../config.js";
import { getSessionPath, ensureDir, findLatestAvatar, } from "../utils/file.js";
import { addOrUpdateWork } from "../utils/works-index.js";
import { resolveProvider } from "./generate-3d-model/providers/index.js";
export function registerGenerate3DModel(server) {
    server.registerTool("q3d_generate_3d_model", "将 Q 版形象图转换为 3D GLB 模型（支持 Hunyuan3D / 302.AI / Tripo3D 自动切换）", {
        avatarPath: {
            type: "string",
            description: "Q 版形象图片路径（可选，默认使用最近生成的 avatar.png）",
        },
        sessionId: {
            type: "string",
            description: "会话 ID（可选，用于确定输出目录）",
        },
    }, async (args) => {
        try {
            let avatarPath = args.avatarPath;
            let sessionId = args.sessionId;
            // Session-scoped avatar lookup: when sessionId is provided, search ONLY
            // within that session's directory. This prevents cross-session avatar
            // leakage where findLatestAvatar() would find another session's avatar.
            if (!avatarPath && sessionId) {
                const sessionAvatarPath = path.join(config.outputDir, sessionId, "avatar.png");
                if (fs.existsSync(sessionAvatarPath)) {
                    avatarPath = sessionAvatarPath;
                }
            }
            // Fallback: global search ONLY when no sessionId was provided
            // (backward compatibility for direct tool calls without session context)
            if (!avatarPath && !sessionId) {
                avatarPath = findLatestAvatar(config.outputDir) || "";
            }
            // Avatar existence check — runs in BOTH mock and real modes
            if (!avatarPath || !fs.existsSync(avatarPath)) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                error: {
                                    code: "MODEL_AVATAR_NOT_FOUND",
                                    message: "未找到 Q 版形象图片",
                                    suggestion: "请先调用 q3d_generate_avatar 生成形象，或提供 avatarPath 参数",
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
            // Determine session from avatar path
            if (!sessionId && avatarPath) {
                sessionId = path.basename(path.dirname(avatarPath));
            }
            // Mock mode: skip real API call but business validation already passed
            if (config.testMode) {
                let providerName = "none";
                try {
                    const provider = await resolveProvider();
                    providerName = provider?.name || "none";
                }
                catch {
                    providerName = "error";
                }
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: true,
                                message: `[MOCK] 3D 模型生成成功（Provider: ${providerName}）`,
                                glbPath: "mock://local/model.glb",
                                provider: providerName,
                                sessionId,
                                estimatedTime: "~30-60s（真实 API）",
                            }),
                        },
                    ],
                };
            }
            // Resolve the best available 3D provider
            const provider = await resolveProvider();
            if (!provider) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                error: {
                                    code: "NO_PROVIDER_AVAILABLE",
                                    message: "没有可用的 3D 生成 Provider",
                                    suggestion: "请配置以下任一方案：\n1. 本地部署 Hunyuan3D（Q3D_HUNYUAN_API_URL，推荐，零成本）\n2. 302.AI 免费积分（Q3D_302AI_API_KEY，无 GPU 用户适用）\n3. Tripo3D API Key（Q3D_TRIPO_API_KEY，保底降级）",
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
            const outputDir = getSessionPath(config.outputDir, sessionId);
            ensureDir(outputDir);
            // Delegate to the selected provider
            const result = await provider.generate({
                avatarPath,
                sessionId: sessionId,
                outputDir,
            });
            if (!result.success) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                error: result.error || {
                                    code: "GENERATE_3D_FAILED",
                                    message: "3D 模型生成失败",
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
            // Update works index
            addOrUpdateWork(sessionId, {
                status: "model_generated",
                glbPath: result.glbPath,
            });
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            glbPath: result.glbPath,
                            sessionId,
                            provider: provider.name,
                            message: result.message ||
                                `${provider.name} 3D GLB 模型已生成：${result.glbPath}`,
                            nextStep: "调用 q3d_create_3d_preview 查看 3D 预览",
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
                                code: "GENERATE_3D_FAILED",
                                message: error.message || "3D 模型生成失败",
                                suggestion: "请检查 Provider 配置是否正确，或稍后重试。",
                            },
                        }),
                    },
                ],
                isError: true,
            };
        }
    });
}
//# sourceMappingURL=generate-3d-model.js.map