/**
 * q3d_assess_model - 3D 模型质量评估工具
 *
 * 工作流程：
 * 1. 检查 GLB 文件是否存在
 * 2. 返回 NEED_QUALITY_ASSESSMENT 信号，附带参考图和 GLB 渲染图路径
 * 3. IDE 使用 Qwen3.7-Plus 模型进行多模态对比分析
 * 4. 回传评估结果，低于 70 分自动触发 refine
 */
import path from "path";
import fs from "fs";
import { config } from "../config.js";
import { getSessionPath } from "../utils/file.js";
import { addOrUpdateWork } from "../utils/works-index.js";
import { TraeCollabSignal } from "../providers/types.js";
import { routeModel, ModelTask } from "../providers/model-router.js";
import { buildQualityAssessmentPrompt } from "../utils/prompt-optimizer.js";
const BLENDER_BRIDGE_URL = process.env.Q3D_BLENDER_BRIDGE_URL || "http://localhost:8777";
/**
 * 通过 Blender Bridge 渲染 GLB 多角度预览图
 */
async function renderGlbPreviews(glbPath, outputDir) {
    try {
        const renderScript = `
import bpy
import os

# Clear scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# Import GLB
bpy.ops.import_scene.gltf(filepath=r"${glbPath.replace(/\\/g, "\\\\")}")

# Get all mesh objects
mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
if not mesh_objects:
    raise Exception("No mesh objects found in GLB")

# Calculate bounding box
import mathutils
bbox = mathutils.Vector()
for obj in mesh_objects:
    for v in obj.bound_box:
        world_v = obj.matrix_world @ mathutils.Vector(v)
        bbox = mathutils.Vector((
            max(abs(bbox.x), abs(world_v.x)),
            max(abs(bbox.y), abs(world_v.y)),
            max(abs(bbox.z), abs(world_v.z))
        ))
max_dim = max(bbox.x, bbox.y, bbox.z) * 1.5

# Setup render
bpy.context.scene.render.engine = 'BLENDER_EEVEE'
bpy.context.scene.render.resolution_x = 512
bpy.context.scene.render.resolution_y = 512
bpy.context.scene.render.film_transparent = True
bpy.context.scene.render.image_settings.file_format = 'PNG'

# Add camera
bpy.ops.object.camera_add()
camera = bpy.context.active_object

# Add light
bpy.ops.object.light_add(type='SUN', location=(1, -1, 2))
light = bpy.context.active_object
light.data.energy = 5
bpy.ops.object.light_add(type='SUN', location=(-1, 1, 1))
fill = bpy.context.active_object
fill.data.energy = 2

bpy.context.scene.camera = camera

# Render front/side/back
views = {
    "front": (0, -max_dim, 0),
    "side": (max_dim, 0, 0),
    "back": (0, max_dim, 0),
}
results = {}
for view_name, cam_pos in views.items():
    camera.location = cam_pos
    camera.rotation_euler = (1.5708, 0, 0)  # Point slightly down
    bpy.context.scene.render.filepath = os.path.join(r"${outputDir.replace(/\\/g, "\\\\")}", f"render_{view_name}.png")
    bpy.ops.render.render(write_still=True)
    results[view_name] = bpy.context.scene.render.filepath

# Output results
import json
print("RENDER_RESULTS:" + json.dumps(results))
`;
        const res = await fetch(`${BLENDER_BRIDGE_URL}/execute-python`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: renderScript }),
            signal: AbortSignal.timeout(60000),
        });
        if (!res.ok)
            return null;
        const result = await res.json();
        // Extract render paths from result
        if (result.result?.result?.stdout) {
            const stdout = result.result.result.stdout;
            const match = stdout.match(/RENDER_RESULTS:(.+)/);
            if (match) {
                return JSON.parse(match[1]);
            }
        }
        // Fallback: check if files exist
        const frontPath = path.join(outputDir, "render_front.png");
        const sidePath = path.join(outputDir, "render_side.png");
        const backPath = path.join(outputDir, "render_back.png");
        if (fs.existsSync(frontPath)) {
            return { front: frontPath, side: sidePath, back: backPath };
        }
        return null;
    }
    catch (err) {
        console.error("[assess-model-quality] Render failed:", err);
        return null;
    }
}
export function registerAssessModelQuality(server) {
    server.registerTool("q3d_assess_model", "评估已生成的 3D 模型质量。通过 Blender Bridge 渲染 GLB 多角度预览图，" +
        "然后使用视觉模型对比渲染图与参考图，给出 5 维度评分（轮廓/比例/色彩/细节/材质）。" +
        "【TRAE 模式】返回 NEED_QUALITY_ASSESSMENT 信号，IDE 使用 Qwen3.7-Plus 模型对比分析，" +
        "评分 >= 70 分通过，否则建议自动 refine。", {
        sessionId: {
            type: "string",
            description: "会话 ID",
        },
        glbPath: {
            type: "string",
            description: "GLB 文件路径（可选，默认从 session 元数据推断）",
        },
        qualityAssessment: {
            type: "string",
            description: "【TRAE 模式】质量评估结果 JSON 字符串（回传用）",
        },
    }, async (args) => {
        try {
            const { sessionId, glbPath: glbPathArg, qualityAssessment } = args;
            const outputDir = getSessionPath(config.outputDir, sessionId);
            // ---- 回传路径：质量评估结果已由 IDE 完成 ----
            if (qualityAssessment) {
                try {
                    const assessment = JSON.parse(qualityAssessment);
                    // 保存评估结果
                    const metadataPath = path.join(outputDir, "metadata.json");
                    let metadata = {};
                    if (fs.existsSync(metadataPath)) {
                        metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
                    }
                    metadata.qualityAssessment = assessment;
                    metadata.assessedAt = new Date().toISOString();
                    const { writeJsonFile } = await import("../utils/file.js");
                    writeJsonFile(metadataPath, metadata);
                    const passed = assessment.pass_threshold || (assessment.scores?.overall >= 70);
                    const overallScore = assessment.scores?.overall || 0;
                    addOrUpdateWork(sessionId, {
                        status: passed ? "model_validated" : "model_needs_refine",
                        qualityScore: overallScore,
                    });
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    success: true,
                                    sessionId,
                                    assessment,
                                    overallScore,
                                    passed,
                                    message: passed
                                        ? `模型质量评估通过（${overallScore} 分）！模型已可用于预览。`
                                        : `模型质量评估未通过（${overallScore} 分，阈值 70 分）。建议调用 q3d_refine_blender_script 根据以下问题优化：\n${(assessment.issues || []).map((i) => `- [${i.severity}] ${i.description}`).join("\n")}`,
                                    nextStep: passed ? "preview" : "q3d_refine_blender_script",
                                    needsRefine: !passed,
                                }),
                            },
                        ],
                    };
                }
                catch {
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    success: false,
                                    error: {
                                        code: "INVALID_ASSESSMENT_FORMAT",
                                        message: "qualityAssessment JSON 格式无效",
                                    },
                                }),
                            },
                        ],
                        isError: true,
                    };
                }
            }
            // ---- 标准路径：确定 GLB 路径 ----
            let glbPath = glbPathArg;
            if (!glbPath) {
                const metadataPath = path.join(outputDir, "metadata.json");
                if (fs.existsSync(metadataPath)) {
                    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
                    glbPath = metadata.glbPath;
                }
            }
            if (!glbPath || !fs.existsSync(glbPath)) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                error: {
                                    code: "GLB_NOT_FOUND",
                                    message: `GLB 文件未找到: ${glbPath || "未指定"}`,
                                    suggestion: "请先调用 q3d_execute_blender_script 生成 GLB 模型。",
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
            // 收集参考图路径
            const metadataPath = path.join(outputDir, "metadata.json");
            let referencePaths = [];
            if (fs.existsSync(metadataPath)) {
                const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
                if (metadata.multiviewPaths) {
                    referencePaths = metadata.multiviewPaths;
                }
            }
            // 尝试渲染 GLB 预览图
            const renderPaths = await renderGlbPreviews(glbPath, outputDir);
            // 模型路由
            const assessRoute = routeModel(ModelTask.QUALITY_ASSESSMENT);
            const prompt = buildQualityAssessmentPrompt(assessRoute.modelId, referencePaths, renderPaths ? [renderPaths.front, renderPaths.side, renderPaths.back] : []);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: false,
                            signal: TraeCollabSignal.NEED_QUALITY_ASSESSMENT,
                            sessionId,
                            glbPath,
                            referencePaths,
                            renderPaths: renderPaths || null,
                            modelRoute: {
                                modelId: assessRoute.modelId,
                                modelName: assessRoute.modelName,
                                reasoning: assessRoute.reasoning,
                                fallbackModelId: assessRoute.fallbackModelId,
                                fallbackModelName: assessRoute.fallbackModelName,
                            },
                            prompt,
                            message: "请使用 " + assessRoute.modelName + " 模型对比 GLB 渲染图与参考图，" +
                                "然后将评估结果 JSON 作为 qualityAssessment 参数重新调用此工具。",
                            hint: "1. 使用 " + assessRoute.modelName + " 模型\n" +
                                "2. 根据 prompt 对比渲染图和参考图\n" +
                                "3. 输出 JSON 格式的评估结果（scores + issues + pass_threshold）\n" +
                                "4. 重新调用 q3d_assess_model，传入 qualityAssessment 参数",
                            renderFailed: !renderPaths,
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
                                code: "ASSESS_MODEL_FAILED",
                                message: error.message || "质量评估失败",
                            },
                        }),
                    },
                ],
                isError: true,
            };
        }
    });
}
//# sourceMappingURL=assess-model-quality.js.map