import path from "path";
import fs from "fs";
import { config } from "../config.js";
import { getSessionPath, ensureDir, writeJsonFile, } from "../utils/file.js";
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
    // 如果找不到，返回基础参考代码
    return `# Q3D Blender Reference Snippets
# 请参考以下函数创建你的脚本

import bpy
import math
from mathutils import Vector, Euler

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()

def create_pbr_material(name, color_rgba, roughness=0.3, metallic=0.0, subsurface=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = color_rgba
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if subsurface > 0:
        bsdf.inputs["Subsurface Weight"].default_value = subsurface
        bsdf.inputs["Subsurface Radius"].default_value = (1.0, 0.3, 0.1)
    return mat

def setup_three_point_lighting():
    bpy.ops.object.light_add(type='AREA', location=(3, 3, 4))
    key = bpy.context.active_object
    key.name = "Key_Light"
    key.data.energy = 80
    key.data.color = (1.0, 0.95, 0.9)
    
    bpy.ops.object.light_add(type='AREA', location=(-3, 1, 3))
    fill = bpy.context.active_object
    fill.name = "Fill_Light"
    fill.data.energy = 40
    fill.data.color = (0.9, 0.95, 1.0)
    
    bpy.ops.object.light_add(type='AREA', location=(0, -3, 3))
    rim = bpy.context.active_object
    rim.name = "Rim_Light"
    rim.data.energy = 60
    rim.data.color = (1.0, 0.9, 1.0)

def export_glb(output_path):
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        export_yup=True,
        export_materials='EXPORT',
        export_apply=True
    )

def smooth_all_meshes():
    for obj in bpy.data.objects:
        if obj.type == 'MESH':
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.shade_smooth()
`;
}
/**
 * 构建脚本生成 Prompt
 */
function buildScriptGenerationPrompt(multiviewPaths, photoAnalysis, style, outputPath, referenceSnippets) {
    return `你是一位专业的 3D 角色艺术家和 Blender Python 专家。

请根据以下多视图图片和角色分析结果，创作一个完整的 Blender Python 脚本，生成高质量的 Q 版 3D 角色。

## 多视图图片路径
- 正面：${multiviewPaths.front || "未提供"}
- 侧面：${multiviewPaths.side || "未提供"}
- 背面：${multiviewPaths.back || "未提供"}

## 角色分析结果
${JSON.stringify(photoAnalysis, null, 2)}

## 目标风格
${style} - ${getStyleDescription(style)}

## 输出路径
${outputPath}

## 参考代码片段
以下是常用的工具函数，你可以参考但不必严格遵循：

\`\`\`python
${referenceSnippets}
\`\`\`

## 手办级质量标准

参考以下质量要求（不要写死具体参数，根据角色特征自主决定）：

1. **造型质量**：
   - 使用细分曲面（Subdivision Surface）确保平滑
   - 避免尖锐边缘，所有过渡圆润自然
   - 头身比约 1:1 到 1:1.5（Q 版比例）
   - 毛发要贴合参考图审美，但不需要超精准

2. **材质质感**：
   - 皮肤：使用 Subsurface Scattering（次表面散射）
   - 头发：高光泽度，使用 Coat 涂层
   - 服装：根据材质类型调整（布料/皮革/金属）
   - 小物件（配饰、装饰）要精准把控细节

3. **核心原则**：
   -  不要写死具体数值（如 radius=1.5, energy=80）
   -  不要用基础几何体简单拼凑
   - ❌ 不要忽略角色特征（发型、服装、配饰）
   - ✅ 根据多视图图片理解角色 3D 结构
   - ✅ 使用高级建模技术（细分、曲线、融球）
   - ✅ 不被代码模板约束，放开手脚创造

4. **创作自由**：
   - 参考代码片段但不受限于此
   - 根据角色特征自主决定参数和技术选择
   - 追求高质量和创意，而非模板化
   - 质量优先，渲染时间次要

## 要求

1. **脚本必须完整可运行**：
   - 包含 import bpy, import math, from mathutils import Vector, Euler
   - 包含场景清理、角色创建、材质、灯光、导出
   - 可以直接在 Blender 中执行

2. **根据图片自由创作**：
   - 分析多视图图片，理解角色的 3D 结构
   - 使用贝塞尔曲线创建头发（更自然）
   - 使用布尔运算创建配饰（更精细）
   - 使用细分曲面增加细节
   - 不受固定几何体约束，追求高质量和创意

3. **Q 版风格要求**：
   - 大头小身体比例（头部约占身体 1/2 到 1/3）
   - 圆润的造型，避免尖锐边缘
   - 大眼睛，可爱的表情

4. **灯光要求**：
   - 使用三灯布光（Key + Fill + Rim）
   - 或自定义更专业的灯光设置

5. **导出要求**：
   - 导出为 GLB 格式
   - 路径：${outputPath}
   - 应用所有修改器

请生成完整的 Python 脚本，只输出代码，不要其他解释。
`;
}
function getStyleDescription(style) {
    const descriptions = {
        kawaii: "软萌大头风格，圆润可爱，大眼睛",
        guofeng: "国风 Q 版，传统服饰元素，优雅气质",
        trendy: "潮玩手办风格，盲盒质感，精致细节",
        simple: "简约卡通，干净线条，现代感",
    };
    return descriptions[style] || descriptions.kawaii;
}
export function registerGenerateBlenderScript(server) {
    server.registerTool("q3d_generate_blender_script", "根据多视图图片和角色分析结果，生成 Blender Python 脚本。" +
        "【TRAE 模式说明】调用此工具后，会返回 NEED_SCRIPT_GENERATION 信号，" +
        "TRAE Agent 需要使用文本模型（如 GLM-5.2/DeepSeek-V4）生成完整脚本，" +
        "然后将脚本路径作为 scriptPath 参数重新调用此工具保存。" +
        "【自由创作】TRAE 模型不受固定模板约束，可以根据图片自由创作高质量 3D 角色。", {
        sessionId: {
            type: "string",
            description: "会话 ID",
        },
        multiviewPaths: {
            type: "string",
            description: "多视图图片路径，JSON 对象格式。" +
                "例如：{\"front\": \"path/to/front.png\", \"side\": \"path/to/side.png\", \"back\": \"path/to/back.png\"}",
        },
        photoAnalysis: {
            type: "string",
            description: "角色分析结果 JSON 字符串",
        },
        style: {
            type: "string",
            description: "风格选择",
            enum: ["kawaii", "guofeng", "trendy", "simple"],
        },
        scriptPath: {
            type: "string",
            description: "【TRAE 模式】已生成的 Blender 脚本路径。" +
                "传入后直接保存脚本，跳过 AI 生成步骤。",
        },
    }, async (args) => {
        try {
            const { sessionId, multiviewPaths: multiviewPathsStr, photoAnalysis: photoAnalysisStr, style = "kawaii", scriptPath, } = args;
            const outputDir = getSessionPath(config.outputDir, sessionId);
            ensureDir(outputDir);
            const outputPath = path.join(outputDir, "blender_script.py");
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
                metadata.glbOutput = glbOutputPath;
                metadata.scriptGeneratedAt = new Date().toISOString();
                writeJsonFile(metadataPath, metadata);
                // 更新 works index
                addOrUpdateWork(sessionId, {
                    status: "script_generated",
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: true,
                                scriptPath: outputPath,
                                glbOutput: glbOutputPath,
                                message: "Blender 脚本保存完成！下一步：调用 q3d_execute_blender_script 执行脚本生成 GLB。",
                                nextStep: "q3d_execute_blender_script",
                            }, null, 2),
                        },
                    ],
                };
            }
            // ---- 标准路径：构建 prompt 并返回协作信号 ----
            if (!multiviewPathsStr || !photoAnalysisStr) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                error: {
                                    code: "MISSING_INPUT",
                                    message: "缺少多视图图片或角色分析结果",
                                    suggestion: "请先调用 q3d_generate_multiview 生成多视图，然后传入 multiviewPaths 和 photoAnalysis。",
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
            let multiviewPaths;
            let photoAnalysis;
            try {
                multiviewPaths = JSON.parse(multiviewPathsStr);
            }
            catch {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                error: {
                                    code: "INVALID_MULTIVIEW_FORMAT",
                                    message: "multiviewPaths 格式错误",
                                    suggestion: '请传入 JSON 对象格式：{"front": "path", "side": "path", "back": "path"}',
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
            try {
                photoAnalysis = JSON.parse(photoAnalysisStr);
            }
            catch {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                error: {
                                    code: "INVALID_ANALYSIS_FORMAT",
                                    message: "photoAnalysis 格式错误",
                                    suggestion: "请传入有效的 JSON 字符串",
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
            // 加载参考代码
            const referenceSnippets = loadReferenceSnippets();
            // 构建 prompt
            const prompt = buildScriptGenerationPrompt(multiviewPaths, photoAnalysis, style, glbOutputPath, referenceSnippets);
            // 模型路由
            const scriptRoute = routeModel(ModelTask.SCRIPT_GENERATION);
            const modelAdaptedPrompt = buildModelAdaptedScriptPrompt(scriptRoute.modelId, prompt, referenceSnippets);
            // 返回协作信号
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: false,
                            signal: TraeCollabSignal.NEED_SCRIPT_GENERATION,
                            sessionId,
                            style,
                            multiviewPaths,
                            photoAnalysis,
                            referenceSnippets,
                            prompt: modelAdaptedPrompt,
                            modelRoute: {
                                modelId: scriptRoute.modelId,
                                modelName: scriptRoute.modelName,
                                reasoning: scriptRoute.reasoning,
                                fallbackModelId: scriptRoute.fallbackModelId,
                                fallbackModelName: scriptRoute.fallbackModelName,
                            },
                            outputPath,
                            glbOutput: glbOutputPath,
                            message: "请使用 " + scriptRoute.modelName + " 模型根据 prompt 生成完整的 Blender Python 脚本，" +
                                "然后将脚本保存为文件，将路径作为 scriptPath 参数重新调用此工具。",
                            hint: "1. 使用 " + scriptRoute.modelName + " 模型（" + scriptRoute.reasoning + "）\n" +
                                "2. 根据 prompt 生成完整的 Python 脚本\n" +
                                "3. 将脚本保存到文件（如 /tmp/blender_script.py）\n" +
                                "4. 重新调用 q3d_generate_blender_script，传入 scriptPath 参数",
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
                                code: "GENERATE_SCRIPT_FAILED",
                                message: error.message || "脚本生成失败",
                            },
                        }),
                    },
                ],
                isError: true,
            };
        }
    });
}
//# sourceMappingURL=generate-blender-script.js.map