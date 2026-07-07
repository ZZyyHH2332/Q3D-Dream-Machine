/**
 * q3d_pipeline_generate - Pipeline 编排器
 *
 * 一站式 3D 建模 Pipeline，自动编排各阶段：
 * 照片分析 → 多视图生成 → 脚本生成 → 脚本执行 → 质量评估 → 智能优化
 *
 * 与单独调用工具的区别：
 * 1. 自动推进 Pipeline 阶段
 * 2. 每个阶段自动选择最优模型
 * 3. 质量不达标自动 refine（最多 3 次）
 * 4. 状态追踪和进度记录
 */

import path from "path";
import fs from "fs";
import { config } from "../config.js";
import { getSessionPath } from "../utils/file.js";
import { addOrUpdateWork } from "../utils/works-index.js";
import { TraeCollabSignal, PhotoAnalysis } from "../providers/types.js";
import {
  routeModel,
  routeModelByComplexity,
  ModelTask,
  getAllTaskRoutes,
} from "../providers/model-router.js";
import { buildModelAdaptedScriptPrompt, buildTextureGenerationPrompt, buildMaterialExtractionPrompt } from "../utils/prompt-optimizer.js";

/** Pipeline 阶段 */
type PipelineStage =
  | "init"
  | "vision"
  | "multiview"
  | "texture"
  | "material"
  | "script"
  | "execution"
  | "assessment"
  | "refine"
  | "done";

/** Pipeline 状态 */
interface PipelineState {
  sessionId: string;
  currentStage: PipelineStage;
  photoAnalysis?: PhotoAnalysis;
  multiviewPaths?: string[];
  texturePaths?: Record<string, string>;
  materialParams?: Record<string, any>;
  scriptPath?: string;
  glbPath?: string;
  qualityScore?: number;
  refineCount: number;
  maxRefineCount: number;
}

/** 加载 Pipeline 状态 */
function loadPipelineState(sessionId: string): PipelineState {
  const outputDir = getSessionPath(config.outputDir, sessionId);
  const statePath = path.join(outputDir, "pipeline_state.json");

  if (fs.existsSync(statePath)) {
    return JSON.parse(fs.readFileSync(statePath, "utf-8"));
  }

  return {
    sessionId,
    currentStage: "init",
    refineCount: 0,
    maxRefineCount: 3,
  };
}

/** 保存 Pipeline 状态 */
function savePipelineState(state: PipelineState): void {
  const outputDir = getSessionPath(config.outputDir, state.sessionId);
  const statePath = path.join(outputDir, "pipeline_state.json");
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

export function registerPipelineGenerate(server: any): void {
  server.registerTool(
    "q3d_pipeline_generate",
    "一站式 3D 建模 Pipeline 编排器。自动推进 Pipeline 各阶段（照片分析→多视图→脚本→执行→评估→优化），" +
      "每个阶段自动选择最优 TRAE Auto Mode 模型，质量不达标自动 refine（最多 3 次）。" +
      "每次调用返回当前阶段的协作信号，IDE 完成后自动推进到下一阶段。",
    {
      sessionId: {
        type: "string",
        description: "会话 ID",
      },
      photoPath: {
        type: "string",
        description: "照片文件路径（首次调用时提供）",
      },
      photoAnalysis: {
        type: "string",
        description: "【TRAE 回传】照片分析结果 JSON 字符串",
      },
      generatedImagePaths: {
        type: "string",
        description: "【TRAE 回传】多视图图片路径列表 JSON 字符串",
      },
      scriptPath: {
        type: "string",
        description: "【TRAE 回传】生成的 Blender 脚本路径",
      },
      qualityAssessment: {
        type: "string",
        description: "【TRAE 回传】质量评估结果 JSON 字符串",
      },
      texturePaths: {
        type: "string",
        description: "【TRAE 回传】纹理贴图路径 JSON 对象（如 {\"skin\":\"...\", \"hair\":\"...\"}）",
      },
      materialParams: {
        type: "string",
        description: "【TRAE 回传】材质参数 JSON 对象（GLM-5.2 提取 + MiniMax-M3 精调）",
      },
      style: {
        type: "string",
        description: "角色风格（可选，默认自动提取）",
      },
    },
    async (args: {
      sessionId: string;
      photoPath?: string;
      photoAnalysis?: string;
      generatedImagePaths?: string;
      scriptPath?: string;
      qualityAssessment?: string;
      texturePaths?: string;
      materialParams?: string;
      style?: string;
    }) => {
      try {
        const {
          sessionId,
          photoPath,
          photoAnalysis,
          generatedImagePaths,
          scriptPath,
          qualityAssessment,
          texturePaths,
          materialParams,
          style,
        } = args;

        const outputDir = getSessionPath(config.outputDir, sessionId);
        const state = loadPipelineState(sessionId);

        // 更新状态
        if (photoAnalysis) state.photoAnalysis = JSON.parse(photoAnalysis);
        if (generatedImagePaths) state.multiviewPaths = JSON.parse(generatedImagePaths);
        if (texturePaths) state.texturePaths = JSON.parse(texturePaths);
        if (materialParams) state.materialParams = JSON.parse(materialParams);
        if (scriptPath) state.scriptPath = scriptPath;
        if (qualityAssessment) {
          const assessment = JSON.parse(qualityAssessment);
          state.qualityScore = assessment.scores?.overall || 0;
          if ((state.qualityScore ?? 0) >= 70) {
            state.currentStage = "done";
          } else {
            state.currentStage = "refine";
            state.refineCount++;
          }
        }

        savePipelineState(state);

        // ---- 根据当前阶段返回协作信号 ----
        switch (state.currentStage) {
          case "init":
          case "vision": {
            // 阶段 1: 照片分析
            if (!photoPath && !state.photoAnalysis) {
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({
                      success: false,
                      signal: TraeCollabSignal.NEED_PHOTO_UPLOAD,
                      sessionId,
                      message: "请先上传照片，然后调用 q3d_pipeline_generate 并传入 photoPath 参数。",
                    }),
                  },
                ],
                isError: true,
              };
            }

            // 如果已有分析，推进到下一阶段
            if (state.photoAnalysis) {
              state.currentStage = "multiview";
              savePipelineState(state);
              // 继续到 multiview 阶段
            } else {
              // 需要视觉分析
              const visionRoute = routeModel(ModelTask.VISION_ANALYSIS);
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({
                      success: false,
                      signal: TraeCollabSignal.NEED_VISION_ANALYSIS,
                      sessionId,
                      currentStage: "vision",
                      modelRoute: {
                        modelId: visionRoute.modelId,
                        modelName: visionRoute.modelName,
                        reasoning: visionRoute.reasoning,
                        fallbackModelId: visionRoute.fallbackModelId,
                        fallbackModelName: visionRoute.fallbackModelName,
                      },
                      message:
                        "请使用 " + visionRoute.modelName + " 模型分析照片，" +
                        "然后将 JSON 结果作为 photoAnalysis 参数重新调用此工具。",
                      nextStage: "multiview",
                    }),
                  },
                ],
              };
            }
          }
          // fall through to multiview

          case "multiview": {
            // 阶段 2: 多视图生成
            if (!state.multiviewPaths) {
              const imageRoute = routeModel(ModelTask.IMAGE_GENERATION);
              const complexityAdjusted = state.photoAnalysis
                ? routeModelByComplexity(ModelTask.IMAGE_GENERATION, state.photoAnalysis)
                : imageRoute;

              // 构建多视图 prompts
              const analysis = state.photoAnalysis;
              const finalStyle = style || "Q版手办风格";
              const viewPrompts = {
                front: analysis
                  ? `Q版角色正面全身图，${finalStyle}风格，白色背景，高质量3D渲染，正面朝向相机，完整展示全身。`
                  : `A cute chibi character, front view, ${finalStyle} style, white background, full body, 3D render.`,
                side: analysis
                  ? `Q版角色侧面全身图，${finalStyle}风格，白色背景，高质量3D渲染，侧面轮廓，完整展示全身。`
                  : `A cute chibi character, side view, ${finalStyle} style, white background, full body, 3D render.`,
                back: analysis
                  ? `Q版角色背面全身图，${finalStyle}风格，白色背景，高质量3D渲染，背面视图，完整展示全身。`
                  : `A cute chibi character, back view, ${finalStyle} style, white background, full body, 3D render.`,
              };

              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({
                      success: false,
                      signal: TraeCollabSignal.NEED_MULTIVIEW_GENERATION,
                      sessionId,
                      currentStage: "multiview",
                      style: finalStyle,
                      viewPrompts,
                      modelRoute: {
                        modelId: complexityAdjusted.modelId,
                        modelName: complexityAdjusted.modelName,
                        reasoning: complexityAdjusted.reasoning,
                        fallbackModelId: complexityAdjusted.fallbackModelId,
                        fallbackModelName: complexityAdjusted.fallbackModelName,
                      },
                      message:
                        "请依次调用 GenerateImage 生成三视图，" +
                        "然后将三个图片路径以 JSON 数组格式作为 generatedImagePaths 参数重新调用此工具。",
                      hint:
                        "1. 使用 " + complexityAdjusted.modelName + " 模型\n" +
                        "2. 生成正面图（prompt: viewPrompts.front）\n" +
                        "3. 生成侧面图（prompt: viewPrompts.side）\n" +
                        "4. 生成背面图（prompt: viewPrompts.back）\n" +
                        "5. 重新调用此工具，传入 generatedImagePaths: [front, side, back]",
                      nextStage: "script",
                    }),
                  },
                ],
              };
            }

            // 推进到纹理阶段
            state.currentStage = "texture";
            savePipelineState(state);
          }
          // fall through to texture

          case "texture": {
            // 阶段 3: 纹理贴图生成（Doubao-Seed-2.1-Turbo）
            if (!state.texturePaths) {
              const textureRoute = routeModel(ModelTask.TEXTURE_GENERATION);
              const analysis = state.photoAnalysis;

              // 为每个部件构建纹理 prompt
              const textureParts = ["skin", "hair", "dress", "accessory", "trim"] as const;
              const texturePrompts = Object.fromEntries(
                textureParts.map((part) => [
                  part,
                  analysis ? buildTextureGenerationPrompt(textureRoute.modelId, analysis, part) : `seamless tileable texture for ${part} of a chibi character, diffuse/albedo map, 1024x1024, flat lighting, no shadows`,
                ])
              );

              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({
                      success: false,
                      signal: TraeCollabSignal.NEED_TEXTURE_GENERATION,
                      sessionId,
                      currentStage: "texture",
                      texturePrompts,
                      textureParts: textureParts,
                      modelRoute: {
                        modelId: textureRoute.modelId,
                        modelName: textureRoute.modelName,
                        reasoning: textureRoute.reasoning,
                        fallbackModelId: textureRoute.fallbackModelId,
                        fallbackModelName: textureRoute.fallbackModelName,
                      },
                      message:
                        "请使用 " + textureRoute.modelName + " 模型调用 GenerateImage 生成纹理贴图，" +
                        "然后将路径 JSON 对象作为 texturePaths 参数重新调用此工具。",
                      hint:
                        "1. 使用 " + textureRoute.modelName + " 模型\n" +
                        "2. 为 skin/hair/dress/accessory/trim 各生成一张 512x512 纹理贴图\n" +
                        "3. 重新调用此工具，传入 texturePaths: {\"skin\":\"...\", \"hair\":\"...\", ...}",
                      nextStage: "material",
                    }),
                  },
                ],
              };
            }

            // 推进到材质提取阶段
            state.currentStage = "material";
            savePipelineState(state);
          }
          // fall through to material

          case "material": {
            // 阶段 4: 材质参数提取 + 精调（GLM-5.2 → MiniMax-M3）
            if (!state.materialParams) {
              const materialRoute = routeModel(ModelTask.MATERIAL_EXTRACTION);
              const tuningRoute = routeModel(ModelTask.PARAMETER_TUNING);
              const analysis = state.photoAnalysis;

              const prompt = analysis
                ? buildMaterialExtractionPrompt(materialRoute.modelId, analysis, state.texturePaths || {})
                : "请分析角色特征，提取每个部件的 PBR 材质参数（baseColor, roughness, metallic, subsurface 等）。";

              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({
                      success: false,
                      signal: TraeCollabSignal.NEED_MATERIAL_EXTRACTION,
                      sessionId,
                      currentStage: "material",
                      materialRoute: {
                        modelId: materialRoute.modelId,
                        modelName: materialRoute.modelName,
                        reasoning: materialRoute.reasoning,
                        fallbackModelId: materialRoute.fallbackModelId,
                        fallbackModelName: materialRoute.fallbackModelName,
                      },
                      tuningRoute: {
                        modelId: tuningRoute.modelId,
                        modelName: tuningRoute.modelName,
                        reasoning: tuningRoute.reasoning,
                      },
                      prompt,
                      materialSpec: {
                        skin: "baseColor HEX, roughness 0.3-0.5, metallic 0, subsurface 0.05-0.2",
                        hair: "baseColor HEX, roughness 0.2-0.4, coatWeight 0.2-0.4",
                        dress: "baseColor HEX, roughness 0.4-0.7, sheenWeight 0.2-0.4",
                        accessory: "baseColor HEX, roughness 0.1-0.3, metallic 0.5-0.9",
                        trim: "baseColor HEX, roughness 0.3-0.5, metallic 0",
                      },
                      message:
                        "请使用 " + materialRoute.modelName + " 模型提取材质参数，" +
                        "然后使用 " + tuningRoute.modelName + " 精调参数，" +
                        "将 JSON 结果作为 materialParams 参数重新调用此工具。",
                      hint:
                        "1. 使用 " + materialRoute.modelName + " 分析角色特征和纹理，提取粗粒度 PBR 参数\n" +
                        "2. 使用 " + tuningRoute.modelName + " 对参数进行精调（确保物理合理性）\n" +
                        "3. 输出 JSON 格式的 materialParams\n" +
                        "4. 重新调用此工具，传入 materialParams 参数",
                      nextStage: "script",
                    }),
                  },
                ],
              };
            }

            // 推进到脚本阶段
            state.currentStage = "script";
            savePipelineState(state);
          }
          // fall through to script

          case "script": {
            // 阶段 3: 脚本生成
            if (!state.scriptPath) {
              const scriptRoute = state.photoAnalysis
                ? routeModelByComplexity(ModelTask.SCRIPT_GENERATION, state.photoAnalysis)
                : routeModel(ModelTask.SCRIPT_GENERATION);

              const glbOutputPath = path.join(outputDir, "model.glb");
              const referenceSnippetsPath = path.join(
                process.cwd(),
                "bridge",
                "blender-scripts",
                "q3d-reference-snippets.py"
              );
              let referenceSnippets = "";
              if (fs.existsSync(referenceSnippetsPath)) {
                referenceSnippets = fs.readFileSync(referenceSnippetsPath, "utf-8");
              }

              const basePrompt = `请生成一个 Q 版 3D 角色的 Blender Python 脚本。

角色特征：
${JSON.stringify(state.photoAnalysis || {}, null, 2)}

纹理贴图（请使用 create_textured_material / create_blended_material 加载）：
${state.texturePaths ? Object.entries(state.texturePaths).map(([k, v]) => `  ${k}: ${v}`).join("\n") : "（无纹理，使用纯色材质）"}

材质参数（请应用到 Principled BSDF 节点）：
${state.materialParams ? JSON.stringify(state.materialParams, null, 2) : "（使用默认材质参数）"}

要求：
- 对所有部件进行 UV 展开（smart_uv_unwrap / cube_uv_project / cylinder_uv_project）
- 使用 create_textured_material 为每个部件加载纹理贴图
- 使用 create_blended_material 实现纯色+纹理混合（如星点图案叠加在裙摆上）
- 严格应用上述材质参数（roughness, metallic, subsurface 等）
- 使用细分曲面确保平滑
- 三点布光
- 导出为 GLB 格式到: ${glbOutputPath}
- 手办级质量`;
              const modelAdaptedPrompt = buildModelAdaptedScriptPrompt(
                scriptRoute.modelId,
                basePrompt,
                referenceSnippets
              );

              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({
                      success: false,
                      signal: TraeCollabSignal.NEED_SCRIPT_GENERATION,
                      sessionId,
                      currentStage: "script",
                      prompt: modelAdaptedPrompt,
                      referenceSnippets,
                      modelRoute: {
                        modelId: scriptRoute.modelId,
                        modelName: scriptRoute.modelName,
                        reasoning: scriptRoute.reasoning,
                        fallbackModelId: scriptRoute.fallbackModelId,
                        fallbackModelName: scriptRoute.fallbackModelName,
                      },
                      message:
                        "请使用 " + scriptRoute.modelName + " 模型生成 Blender Python 脚本，" +
                        "保存为文件后将路径作为 scriptPath 参数重新调用此工具。",
                      hint:
                        "1. 使用 " + scriptRoute.modelName + " 模型（" + scriptRoute.reasoning + "）\n" +
                        "2. 根据 prompt 生成完整的 Python 脚本\n" +
                        "3. 保存脚本到文件\n" +
                        "4. 重新调用此工具，传入 scriptPath 参数",
                      nextStage: "execution",
                    }),
                  },
                ],
              };
            }

            // 推进到执行阶段
            state.currentStage = "execution";
            savePipelineState(state);
          }
          // fall through to execution

          case "execution": {
            // 阶段 4: 脚本执行 — 提示用户调用 execute_blender_script
            addOrUpdateWork(sessionId, { status: "pipeline_executing" });

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    success: true,
                    sessionId,
                    currentStage: "execution",
                    scriptPath: state.scriptPath,
                    message:
                      "Script 就绪！请调用 q3d_execute_blender_script 执行脚本。\n" +
                      "执行完成后，调用 q3d_pipeline_generate 继续 Pipeline（自动进入质量评估阶段）。",
                    nextStage: "assessment",
                    nextAction: "q3d_execute_blender_script",
                  }),
                },
              ],
            };
          }

          case "assessment": {
            // 阶段 5: 质量评估
            const assessRoute = routeModel(ModelTask.QUALITY_ASSESSMENT);

            // 尝试获取 GLB 路径
            const metadataPath = path.join(outputDir, "metadata.json");
            let glbPath = "";
            if (fs.existsSync(metadataPath)) {
              const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
              glbPath = metadata.glbPath || "";
            }

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    success: false,
                    signal: TraeCollabSignal.NEED_QUALITY_ASSESSMENT,
                    sessionId,
                    currentStage: "assessment",
                    glbPath,
                    modelRoute: {
                      modelId: assessRoute.modelId,
                      modelName: assessRoute.modelName,
                      reasoning: assessRoute.reasoning,
                      fallbackModelId: assessRoute.fallbackModelId,
                      fallbackModelName: assessRoute.fallbackModelName,
                    },
                    message:
                      "请使用 " + assessRoute.modelName + " 模型评估 3D 模型质量，" +
                      "将 JSON 评估结果作为 qualityAssessment 参数重新调用此工具。",
                    hint:
                      "1. 使用 " + assessRoute.modelName + " 模型\n" +
                      "2. 对比 GLB 渲染图与参考图\n" +
                      "3. 输出 JSON（scores + issues + pass_threshold）\n" +
                      "4. 重新调用此工具，传入 qualityAssessment 参数",
                    nextStage: "done_or_refine",
                  }),
                },
              ],
            };
          }

          case "refine": {
            // 阶段 6: 优化
            if (state.refineCount >= state.maxRefineCount) {
              state.currentStage = "done";
              savePipelineState(state);
              addOrUpdateWork(sessionId, { status: "pipeline_max_refine" });

              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({
                      success: true,
                      sessionId,
                      currentStage: "done",
                      message: `已达到最大 refine 次数（${state.maxRefineCount}），Pipeline 结束。` +
                        `当前质量评分: ${state.qualityScore}。`,
                      qualityScore: state.qualityScore,
                      warning: "模型未达到质量阈值，可手动调用 q3d_refine_blender_script 继续优化。",
                    }),
                  },
                ],
              };
            }

            const refineRoute = routeModel(ModelTask.SCRIPT_REFINEMENT);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    success: false,
                    signal: TraeCollabSignal.NEED_SCRIPT_GENERATION,
                    sessionId,
                    currentStage: "refine",
                    refineCount: state.refineCount,
                    maxRefine: state.maxRefineCount,
                    modelRoute: {
                      modelId: refineRoute.modelId,
                      modelName: refineRoute.modelName,
                      reasoning: refineRoute.reasoning,
                      fallbackModelId: refineRoute.fallbackModelId,
                      fallbackModelName: refineRoute.fallbackModelName,
                    },
                    message:
                      `第 ${state.refineCount}/${state.maxRefineCount} 次优化。` +
                      `请使用 ${refineRoute.modelName} 模型修复脚本，` +
                      `将新脚本路径作为 scriptPath 参数重新调用此工具。`,
                    nextStage: "execution",
                  }),
                },
              ],
            };
          }

          case "done": {
            addOrUpdateWork(sessionId, { status: "pipeline_complete" });
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    success: true,
                    sessionId,
                    currentStage: "done",
                    qualityScore: state.qualityScore,
                    message:
                      `Pipeline 完成！` +
                      (state.qualityScore && state.qualityScore >= 70
                        ? `模型质量评分: ${state.qualityScore}/100，通过质量阈值。`
                        : `模型已生成，可在网页中预览或手动优化。`),
                    previewUrl: `q3d-dream-machine-app.html?session=${sessionId}`,
                  }),
                },
              ],
            };
          }

          default:
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    success: false,
                    error: {
                      code: "UNKNOWN_STAGE",
                      message: `Unknown pipeline stage: ${state.currentStage}`,
                    },
                  }),
                },
              ],
              isError: true,
            };
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: {
                  code: "PIPELINE_FAILED",
                  message: error.message || "Pipeline 执行失败",
                },
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );
}