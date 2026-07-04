import path from "path";
import fs from "fs";
import { config } from "../config.js";
import { getSessionPath, ensureDir, } from "../utils/file.js";
import { addOrUpdateWork } from "../utils/works-index.js";
import { TraeCollabSignal } from "../providers/types.js";
import { routeModel, ModelTask } from "../providers/model-router.js";
import { buildModelAdaptedScriptPrompt } from "../utils/prompt-optimizer.js";
/**
 * 读取参考代码片段
 */
function loadReferenceSnippets() {
    const snippetsPath = path.join(process.cwd(), "bridge", "blender-scripts", "q3d-reference-snippets.py");
    if (fs.existsSync(snippetsPath)) {
        return fs.readFileSync(snippetsPath, "utf-8");
    }
    return "";
}
/**
 * 构建脚本优化 Prompt
 */
function buildScriptRefinePrompt(currentScript, feedback, errorLog, referenceSnippets) {
    return `你是一位专业的 3D 角色艺术家和 Blender Python 专家。

请根据用户反馈修改 Blender Python 脚本。

## 当前脚本
\`\`\`python
${currentScript}
\`\`\`

## 用户反馈
${feedback}

${errorLog ? `## 错误日志\n\`\`\`\n${errorLog}\n\`\`\`\n` : ""}

## 参考代码片段
${referenceSnippets ? `\`\`\`python\n${referenceSnippets}\n\`\`\`` : "无"}

## 要求

1. **根据反馈修改脚本**：
   - 如果是质量问题（如"头发太短"、"眼睛太小"），调整相应参数
   - 如果是错误修复，根据错误日志定位问题并修复
   - 保持脚本的整体结构，只修改需要调整的部分

2. **脚本必须完整可运行**：
   - 包含所有必要的 import
   - 包含场景清理、角色创建、材质、灯光、导出
   - 可以直接在 Blender 中执行

3. **输出完整的修改后脚本**：
   - 只输出 Python 代码
   - 不要输出解释或说明
   - 确保代码格式正确

请生成修改后的完整 Python 脚本。
`;
}
export function registerRefineBlenderScript(server) {
    server.registerTool("q3d_refine_blender_script", "根据用户反馈或错误日志，迭代优化 Blender Python 脚本。" +
        "【TRAE 模式说明】调用此工具后，会返回 NEED_SCRIPT_GENERATION 信号，" +
        "TRAE Agent 需要使用文本模型根据反馈修改脚本，" +
        "然后将修改后的脚本路径作为 scriptPath 参数重新调用此工具保存。", {
        sessionId: {
            type: "string",
            description: "会话 ID",
        },
        feedback: {
            type: "string",
            description: "用户反馈，描述需要修改的内容。" +
                "例如：'头发太短'、'眼睛太小'、'颜色不对'、'导出失败' 等。",
        },
        errorLog: {
            type: "string",
            description: "错误日志（可选），如果脚本执行失败，提供错误信息。",
        },
        scriptPath: {
            type: "string",
            description: "【TRAE 模式】修改后的脚本路径。" +
                "传入后直接保存，跳过 AI 生成步骤。",
        },
    }, async (args) => {
        try {
            const { sessionId, feedback, errorLog, scriptPath } = args;
            const outputDir = getSessionPath(config.outputDir, sessionId);
            ensureDir(outputDir);
            const currentScriptPath = path.join(outputDir, "blender_script.py");
            const outputPath = path.join(outputDir, "blender_script_v2.py");
            const glbOutputPath = path.join(outputDir, "model.glb");
            // ---- 快速路径：如果已提供 scriptPath，直接保存 ----
            if (scriptPath) {
                if (!fs.existsSync(scriptPath)) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    success: false,
                                    error: {
                                        code: "SCRIPT_NOT_FOUND",
                                        message: `脚本文件不存在: ${scriptPath}`,
                                    },
                                }),
                            },
                        ],
                        isError: true,
                    };
                }
                // 复制脚本到 session 目录
                const scriptContent = fs.readFileSync(scriptPath, "utf-8");
                fs.writeFileSync(outputPath, scriptContent, "utf-8");
                // 更新元数据
                const metadataPath = path.join(outputDir, "metadata.json");
                let metadata = {};
                if (fs.existsSync(metadataPath)) {
                    metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
                }
                metadata.blenderScript = outputPath;
                metadata.refinedAt = new Date().toISOString();
                metadata.feedback = feedback;
                const { writeJsonFile } = await import("../utils/file.js");
                writeJsonFile(metadataPath, metadata);
                // 更新 works index
                addOrUpdateWork(sessionId, {
                    status: "script_refined",
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: true,
                                scriptPath: outputPath,
                                glbOutput: glbOutputPath,
                                feedback,
                                message: "脚本已更新！下一步：调用 q3d_execute_blender_script 重新执行脚本。",
                                nextStep: "q3d_execute_blender_script",
                            }, null, 2),
                        },
                    ],
                };
            }
            // ---- 标准路径：构建 prompt 并返回协作信号 ----
            if (!feedback) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                error: {
                                    code: "MISSING_FEEDBACK",
                                    message: "缺少用户反馈",
                                    suggestion: "请提供 feedback 参数，描述需要修改的内容。",
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
            // 读取当前脚本
            if (!fs.existsSync(currentScriptPath)) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                error: {
                                    code: "NO_CURRENT_SCRIPT",
                                    message: `当前脚本不存在: ${currentScriptPath}`,
                                    suggestion: "请先调用 q3d_generate_blender_script 生成初始脚本。",
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
            const currentScript = fs.readFileSync(currentScriptPath, "utf-8");
            const referenceSnippets = loadReferenceSnippets();
            // 构建 prompt
            const prompt = buildScriptRefinePrompt(currentScript, feedback, errorLog, referenceSnippets);
            // 模型路由
            const refineRoute = routeModel(ModelTask.SCRIPT_REFINEMENT);
            const modelAdaptedPrompt = buildModelAdaptedScriptPrompt(refineRoute.modelId, prompt, referenceSnippets);
            // 返回协作信号
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: false,
                            signal: TraeCollabSignal.NEED_SCRIPT_GENERATION,
                            sessionId,
                            feedback,
                            errorLog,
                            currentScriptPath,
                            prompt: modelAdaptedPrompt,
                            modelRoute: {
                                modelId: refineRoute.modelId,
                                modelName: refineRoute.modelName,
                                reasoning: refineRoute.reasoning,
                                fallbackModelId: refineRoute.fallbackModelId,
                                fallbackModelName: refineRoute.fallbackModelName,
                            },
                            outputPath,
                            glbOutput: glbOutputPath,
                            message: "请使用 " + refineRoute.modelName + " 模型根据 prompt 修改脚本，" +
                                "然后将修改后的脚本保存为文件，将路径作为 scriptPath 参数重新调用此工具。",
                            hint: "1. 使用 " + refineRoute.modelName + " 模型（" + refineRoute.reasoning + "）\n" +
                                "2. 根据 prompt 修改脚本\n" +
                                "3. 将脚本保存到文件\n" +
                                "4. 重新调用 q3d_refine_blender_script，传入 scriptPath 参数",
                        }),
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
                                code: "REFINE_SCRIPT_FAILED",
                                message: error.message || "脚本优化失败",
                            },
                        }),
                    },
                ],
                isError: true,
            };
        }
    });
}
//# sourceMappingURL=refine-blender-script.js.map