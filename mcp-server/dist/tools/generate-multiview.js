import path from "path";
import fs from "fs";
import { config, isApiConfigured } from "../config.js";
import { readFileAsBase64, getSessionPath, writeJsonFile, copyFile, ensureDir, } from "../utils/file.js";
import { addOrUpdateWork } from "../utils/works-index.js";
import { resolveAvatarProvider, } from "../providers/avatar-resolver.js";
import { TraeCollabError } from "../providers/trae-native.js";
import { TraeCollabSignal } from "../providers/types.js";
import { buildTraeGeneratePrompt, AUTO_MODE_MODELS } from "../providers/trae-native.js";
import { enhanceFor3D } from "../utils/prompt-3d-ready.js";
import { routeModel, ModelTask } from "../providers/model-router.js";
// Style configuration
const STYLE_CONFIG = {
    kawaii: { name: "kawaii", label: "软萌大头" },
    guofeng: { name: "guofeng", label: "国风 Q 版" },
    trendy: { name: "trendy", label: "潮玩手办" },
    simple: { name: "simple", label: "简约卡通" },
};
/**
 * 从照片分析结果中提取风格
 * 优先使用照片中的原始风格，而非预定义选项
 */
function extractStyleFromAnalysis(analysis) {
    // 从 overallVibe 推断风格
    const vibe = analysis.overallVibe?.toLowerCase() || "";
    if (vibe.includes("国") || vibe.includes("传统") || vibe.includes("古风")) {
        return "guofeng";
    }
    if (vibe.includes("潮") || vibe.includes("时尚") || vibe.includes("现代")) {
        return "trendy";
    }
    if (vibe.includes("简") || vibe.includes("干净") || vibe.includes("清爽")) {
        return "simple";
    }
    // 默认使用 kawaii（Q 版最常见风格）
    return "kawaii";
}
/**
 * 保存多视图图片到会话目录
 */
function saveMultiviewImages(uploadId, imagePaths, style, photoAnalysis) {
    const outputDir = getSessionPath(config.outputDir, uploadId);
    ensureDir(outputDir);
    const multiviewPaths = [];
    const viewMap = [
        ["front", "avatar_front.png"],
        ["side", "avatar_side.png"],
        ["back", "avatar_back.png"],
    ];
    for (const [view, filename] of viewMap) {
        const srcPath = imagePaths[view];
        if (srcPath && fs.existsSync(srcPath)) {
            const destPath = path.join(outputDir, filename);
            copyFile(srcPath, destPath);
            multiviewPaths.push(destPath);
        }
    }
    // Save metadata
    const metadata = {
        uploadId,
        style,
        multiviewPaths,
        photoAnalysis: photoAnalysis || null,
        provider: "trae-native",
        generatedAt: new Date().toISOString(),
        type: "multiview",
    };
    const metadataPath = path.join(outputDir, "metadata.json");
    writeJsonFile(metadataPath, metadata);
    // Update works index
    addOrUpdateWork(uploadId, {
        status: "multiview_generated",
        style: style,
        styleName: STYLE_CONFIG[style]?.label || "未知风格",
    });
    return { multiviewPaths, metadataPath };
}
export function registerGenerateMultiview(server) {
    server.registerTool("q3d_generate_multiview", "根据上传的照片生成多视图（正面/侧面/背面）2D 图像，用于高质量 3D 重建。" +
        "【TRAE 模式说明】调用此工具后，会返回三个 imagePrompt（front/side/back），" +
        "TRAE Agent 需要依次调用 GenerateImage 工具生成三张图，" +
        "然后将三个图片路径作为 generatedImagePaths 参数重新调用此工具保存。" +
        "【多模型协作】支持指定 Auto Mode 模型（如 Doubao-Seed-2.1-Pro）进行更精准的照片分析。", {
        uploadId: {
            type: "string",
            description: "上传照片时返回的 Session ID",
        },
        style: {
            type: "string",
            description: "风格选择（可选）。如果不提供，将从照片分析中自动提取角色风格。" +
                "预定义选项：kawaii(软萌大头)、guofeng(国风 Q 版)、trendy(潮玩手办)、simple(简约卡通)。" +
                "【推荐】不指定风格，让系统根据照片自动匹配角色原始风格。",
            enum: ["kawaii", "guofeng", "trendy", "simple"],
        },
        photoAnalysis: {
            type: "string",
            description: "【TRAE 模式可选】已分析的照片人物特征 JSON 字符串。" +
                "包含字段：gender, ageRange, hairStyle, facialFeatures, clothing, expression, overallVibe。",
        },
        generatedImagePaths: {
            type: "string",
            description: "【TRAE 模式】已生成的三视图图片路径，JSON 数组格式。" +
                "例如：[\"path/to/front.png\", \"path/to/side.png\", \"path/to/back.png\"]。" +
                "传入后直接保存图片，跳过 AI 生成步骤。",
        },
        model: {
            type: "string",
            description: "【TRAE 模式可选】指定 Auto Mode 模型进行照片分析。" +
                "可选值: Doubao-Seed-2.1-Pro（推荐）、GLM-5.2、DeepSeek-V4-Pro 等。",
            enum: AUTO_MODE_MODELS.map((m) => m.id),
        },
    }, async (args) => {
        try {
            const { uploadId, style: styleArg, photoAnalysis: photoAnalysisStr, generatedImagePaths, model, } = args;
            // 风格处理：优先使用传入的风格，否则后续从照片分析中提取
            let style = styleArg;
            // Check API configuration
            if (!config.testMode && !isApiConfigured()) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                error: {
                                    code: "API_NOT_CONFIGURED",
                                    message: "AI 图像生成能力未配置",
                                    suggestion: "请配置 Q3D_AI_PROVIDER=trae（TRAE 原生模式，无需 API Key）",
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
            // Find uploaded photo
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
            const uploadedFiles = fs
                .readdirSync(uploadDir)
                .filter((f) => f.startsWith("original."));
            if (uploadedFiles.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                error: {
                                    code: "UPLOAD_FILE_MISSING",
                                    message: "上传目录中没有找到原始照片",
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
            const originalPath = path.join(uploadDir, uploadedFiles[0]);
            // ---- 快速路径：如果已提供 generatedImagePaths，直接保存 ----
            if (generatedImagePaths) {
                let photoAnalysisObj = undefined;
                if (photoAnalysisStr) {
                    try {
                        photoAnalysisObj = JSON.parse(photoAnalysisStr);
                    }
                    catch {
                        // 解析失败则不存 photoAnalysis
                    }
                }
                let paths;
                try {
                    const parsed = JSON.parse(generatedImagePaths);
                    if (Array.isArray(parsed)) {
                        paths = {
                            front: parsed[0],
                            side: parsed[1],
                            back: parsed[2],
                        };
                    }
                    else {
                        paths = parsed;
                    }
                }
                catch {
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    success: false,
                                    error: {
                                        code: "INVALID_PATHS_FORMAT",
                                        message: "generatedImagePaths 格式错误",
                                        suggestion: "请传入 JSON 数组格式：[\"front.png\", \"side.png\", \"back.png\"]",
                                    },
                                }),
                            },
                        ],
                        isError: true,
                    };
                }
                // 确保 style 已定义
                const finalStyle = style || "kawaii";
                const { multiviewPaths, metadataPath } = saveMultiviewImages(uploadId, paths, finalStyle, photoAnalysisObj);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: true,
                                multiviewPaths,
                                style,
                                metadataPath,
                                provider: "trae-native",
                                message: `多视图保存完成！共 ${multiviewPaths.length} 张图。下一步：调用 q3d_generate_blender_script 生成 Blender 脚本。`,
                                nextStep: "q3d_generate_blender_script",
                            }, null, 2),
                        },
                    ],
                };
            }
            // ---- 标准路径：构建多视图 prompts 并返回协作信号 ----
            const provider = await resolveAvatarProvider("trae");
            const base64 = readFileAsBase64(originalPath);
            // Step 1: Vision 分析
            let analysis;
            if (photoAnalysisStr) {
                try {
                    analysis = JSON.parse(photoAnalysisStr);
                }
                catch {
                    // 解析失败则需要重新分析
                    try {
                        analysis = await provider.analyzePhoto(base64);
                    }
                    catch (err) {
                        if (err instanceof TraeCollabError &&
                            err.signal === TraeCollabSignal.NEED_VISION_ANALYSIS) {
                            const visionRoute = routeModel(ModelTask.VISION_ANALYSIS);
                            return {
                                content: [
                                    {
                                        type: "text",
                                        text: JSON.stringify({
                                            success: false,
                                            signal: TraeCollabSignal.NEED_VISION_ANALYSIS,
                                            message: "请使用 TRAE Vision 能力分析照片，将结果作为 photoAnalysis 参数传入。",
                                            visionPrompt: err.data.visionPrompt,
                                            modelRoute: {
                                                modelId: visionRoute.modelId,
                                                modelName: visionRoute.modelName,
                                                reasoning: visionRoute.reasoning,
                                                fallbackModelId: visionRoute.fallbackModelId,
                                                fallbackModelName: visionRoute.fallbackModelName,
                                            },
                                        }),
                                    },
                                ],
                                isError: true,
                            };
                        }
                        throw err;
                    }
                }
            }
            else {
                try {
                    analysis = await provider.analyzePhoto(base64);
                }
                catch (err) {
                    if (err instanceof TraeCollabError &&
                        err.signal === TraeCollabSignal.NEED_VISION_ANALYSIS) {
                        const visionRoute = routeModel(ModelTask.VISION_ANALYSIS);
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: JSON.stringify({
                                        success: false,
                                        signal: TraeCollabSignal.NEED_VISION_ANALYSIS,
                                        message: "请使用 TRAE Vision 能力分析照片，将结果作为 photoAnalysis 参数传入。",
                                        visionPrompt: err.data.visionPrompt,
                                        modelRoute: {
                                            modelId: visionRoute.modelId,
                                            modelName: visionRoute.modelName,
                                            reasoning: visionRoute.reasoning,
                                            fallbackModelId: visionRoute.fallbackModelId,
                                            fallbackModelName: visionRoute.fallbackModelName,
                                        },
                                    }),
                                },
                            ],
                            isError: true,
                        };
                    }
                    throw err;
                }
            }
            // 如果未指定风格，从照片分析中提取
            if (!style) {
                style = extractStyleFromAnalysis(analysis);
                console.log(`[generate-multiview] Auto-extracted style from photo: ${style}`);
            }
            // 确保 style 已定义（TypeScript 类型检查）
            const finalStyle = style || "kawaii";
            // Step 2: 构建三视图 prompts
            const basePrompt = buildTraeGeneratePrompt(finalStyle, analysis);
            const viewPrompts = {};
            for (const view of ["front", "side", "back"]) {
                const enhanced = enhanceFor3D(basePrompt, finalStyle, true, view);
                viewPrompts[view] = enhanced.prompt;
            }
            // Step 3: 返回协作信号，要求 TRAE Agent 生成三张图
            const imageRoute = routeModel(ModelTask.IMAGE_GENERATION);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: false,
                            signal: TraeCollabSignal.NEED_MULTIVIEW_GENERATION,
                            provider: "trae-native",
                            style: finalStyle,
                            photoAnalysis: analysis,
                            viewPrompts: {
                                front: viewPrompts.front,
                                side: viewPrompts.side,
                                back: viewPrompts.back,
                            },
                            modelRoute: {
                                modelId: imageRoute.modelId,
                                modelName: imageRoute.modelName,
                                reasoning: imageRoute.reasoning,
                                fallbackModelId: imageRoute.fallbackModelId,
                                fallbackModelName: imageRoute.fallbackModelName,
                            },
                            message: "请依次调用 GenerateImage 工具生成三张图（正面/侧面/背面），" +
                                "然后将三个图片路径作为 generatedImagePaths 参数（JSON 数组格式）重新调用此工具。",
                            hint: "1. 使用 " + imageRoute.modelName + " 模型\n" +
                                "2. 调用 GenerateImage，prompt 使用 viewPrompts.front，尺寸 1024x1024\n" +
                                "3. 调用 GenerateImage，prompt 使用 viewPrompts.side，尺寸 1024x1024\n" +
                                "4. 调用 GenerateImage，prompt 使用 viewPrompts.back，尺寸 1024x1024\n" +
                                "5. 重新调用 q3d_generate_multiview，传入 generatedImagePaths: [frontPath, sidePath, backPath]",
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
                                code: "GENERATE_MULTIVIEW_FAILED",
                                message: error.message || "多视图生成失败",
                                suggestion: "请检查照片是否清晰，或稍后重试。",
                            },
                        }),
                    },
                ],
                isError: true,
            };
        }
    });
}
//# sourceMappingURL=generate-multiview.js.map