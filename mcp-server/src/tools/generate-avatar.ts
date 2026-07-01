import path from "path";
import fs from "fs";
import { config, isApiConfigured } from "../config.js";
import { downloadImage } from "../utils/api.js";
import {
  readFileAsBase64,
  getSessionPath,
  writeJsonFile,
  copyFile,
} from "../utils/file.js";
import { addOrUpdateWork } from "../utils/works-index.js";
import {
  resolveAvatarProvider,
} from "../providers/avatar-resolver.js";
import { TraeCollabError } from "../providers/trae-native.js";
import { TraeCollabSignal, PhotoAnalysis } from "../providers/types.js";
import { buildTraeGeneratePrompt } from "../providers/trae-native.js";

// Style configuration for avatar generation
const STYLE_CONFIG: Record<string, { name: string; label: string }> = {
  kawaii: { name: "kawaii", label: "软萌大头" },
  guofeng: { name: "guofeng", label: "国风Q版" },
  trendy: { name: "trendy", label: "潮玩手办" },
  simple: { name: "simple", label: "简约卡通" },
};

/**
 * 从本地路径保存头像图片到会话目录
 * 用于 TRAE Native 模式下，TRAE Agent 用 GenerateImage 生成图片后回传
 */
function saveAvatarFromPath(
  uploadId: string,
  imagePath: string,
  style: string,
  customPrompt: string | undefined,
  photoAnalysis?: PhotoAnalysis | string
): { avatarPath: string; metadataPath: string; revisedPrompt: string } {
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Image file not found: ${imagePath}`);
  }

  const outputDir = getSessionPath(config.outputDir, uploadId);
  const avatarPath = path.join(outputDir, "avatar.png");

  // Copy to session directory
  copyFile(imagePath, avatarPath);

  // Build revised prompt for metadata
  let revisedPrompt = "";
  if (typeof photoAnalysis === "object" && photoAnalysis !== null) {
    try {
      revisedPrompt = buildTraeGeneratePrompt(
        style,
        photoAnalysis,
        customPrompt
      );
    } catch {
      revisedPrompt = customPrompt || style;
    }
  } else {
    revisedPrompt = customPrompt || style;
  }

  // Save metadata
  const uploadDir = path.join(config.uploadsDir, uploadId);
  const uploadedFiles = fs
    .readdirSync(uploadDir)
    .filter((f) => f.startsWith("original."));
  const originalPath =
    uploadedFiles.length > 0
      ? path.join(uploadDir, uploadedFiles[0])
      : "";

  const metadata = {
    uploadId,
    originalPath,
    avatarPath,
    style,
    customPrompt: customPrompt || null,
    revisedPrompt,
    photoAnalysis: photoAnalysis || null,
    provider: "trae-native",
    generatedAt: new Date().toISOString(),
  };
  const metadataPath = path.join(outputDir, "metadata.json");
  writeJsonFile(metadataPath, metadata);

  // Update works index
  addOrUpdateWork(uploadId, {
    status: "avatar_generated",
    style: style as "kawaii" | "guofeng" | "trendy" | "simple",
    styleName: STYLE_CONFIG[style]?.label || "未知风格",
    avatarPath,
  });

  return { avatarPath, metadataPath, revisedPrompt };
}

export function registerGenerateAvatar(server: any): void {
  server.registerTool(
    "q3d_generate_avatar",
    "根据上传的照片生成 Q 版 2D 形象。支持多种 AI Provider：" +
      "TRAE 原生（默认，使用内置 Vision + GenerateImage）、外部 API、Mock 模式。" +
      "【TRAE 模式说明】如果你运行在 TRAE 环境中，可以先使用内置 Vision 分析照片，" +
      "将分析结果作为 photoAnalysis 参数传入；然后用 GenerateImage 工具生成图片，" +
      "将图片路径作为 generatedImagePath 参数传入，即可跳过 AI 调用步骤直接保存。",
    {
      uploadId: {
        type: "string",
        description: "上传照片时返回的 Session ID",
      },
      style: {
        type: "string",
        description: "风格选择",
        enum: ["kawaii", "guofeng", "trendy", "simple"],
      },
      customPrompt: {
        type: "string",
        description: "自定义提示词（可选），覆盖默认风格 prompt",
      },
      photoAnalysis: {
        type: "string",
        description:
          "【TRAE 模式可选】已分析的照片人物特征 JSON 字符串。" +
          "包含字段：gender, ageRange, hairStyle, facialFeatures, clothing, expression, overallVibe。" +
          "传入后跳过 Vision 分析步骤。",
      },
      generatedImagePath: {
        type: "string",
        description:
          "【TRAE 模式可选】已生成的头像图片本地路径。" +
          "传入后直接保存图片，跳过 AI 生成步骤。通常由 TRAE GenerateImage 工具生成。",
      },
      imageProvider: {
        type: "string",
        description:
          "【可选】指定本次使用的 AI Provider。默认 auto 自动选择。" +
          "可选值：auto, trae, external, mock",
        enum: ["auto", "trae", "external", "mock"],
      },
    },
    async (args: {
      uploadId: string;
      style?: string;
      customPrompt?: string;
      photoAnalysis?: string;
      generatedImagePath?: string;
      imageProvider?: "auto" | "trae" | "external" | "mock";
    }) => {
      try {
        const {
          uploadId,
          style = "kawaii",
          customPrompt,
          photoAnalysis: photoAnalysisStr,
          generatedImagePath,
          imageProvider = "auto",
        } = args;

        // Check API configuration (skip in test mode / trae mode)
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
                    suggestion:
                      "请配置 Q3D_AI_PROVIDER=trae（TRAE 原生模式，无需 API Key）" +
                      "，或在 .env 中填写 Q3D_API_KEY 使用外部 API。" +
                      "TRAE 模式下请先使用内置 Vision 分析照片，再调用 GenerateImage 生成图片。",
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
                    suggestion: "请重新上传照片",
                  },
                }),
              },
            ],
            isError: true,
          };
        }

        const originalPath = path.join(uploadDir, uploadedFiles[0]);

        // Check file size (warn if > 4MB)
        const stats = fs.statSync(originalPath);
        if (stats.size > 4 * 1024 * 1024) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: {
                    code: "UPLOAD_FILE_TOO_LARGE",
                    message: `图片过大 (${(stats.size / 1024 / 1024).toFixed(1)}MB)，建议压缩到 4MB 以下`,
                    suggestion: "请压缩图片后重新上传，或使用更小尺寸的照片",
                  },
                }),
              },
            ],
            isError: true,
          };
        }

        // ---- 快速路径：如果已提供 generatedImagePath，直接保存 ----
        if (generatedImagePath) {
          let photoAnalysisObj: PhotoAnalysis | undefined = undefined;
          if (photoAnalysisStr) {
            try {
              photoAnalysisObj = JSON.parse(photoAnalysisStr);
            } catch {
              // 解析失败就不存 photoAnalysis
            }
          }

          const { avatarPath, metadataPath, revisedPrompt } =
            saveAvatarFromPath(
              uploadId,
              generatedImagePath,
              style,
              customPrompt,
              photoAnalysisObj
            );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    avatarPath,
                    style,
                    metadataPath,
                    provider: "trae-native",
                    revisedPrompt,
                    message: `Q 版形象保存完成！路径: ${avatarPath}`,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        // ---- 标准路径：通过 Provider 生成 ----
        const provider = await resolveAvatarProvider(imageProvider);

        // Parse photoAnalysis if provided
        let photoAnalysis: PhotoAnalysis | undefined = undefined;
        if (photoAnalysisStr) {
          try {
            photoAnalysis = JSON.parse(photoAnalysisStr);
          } catch {
            // 解析失败则在需要时重新分析
          }
        }

        const base64 = readFileAsBase64(originalPath);

        // Step 1: Vision 分析（如果没有传入 photoAnalysis）
        let analysis: PhotoAnalysis;
        if (photoAnalysis) {
          analysis = photoAnalysis;
        } else {
          try {
            analysis = await provider.analyzePhoto(base64);
          } catch (err: any) {
            // TRAE 协作模式：需要 Vision 分析
            if (err instanceof TraeCollabError &&
                err.signal === TraeCollabSignal.NEED_VISION_ANALYSIS) {
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({
                      success: false,
                      signal: TraeCollabSignal.NEED_VISION_ANALYSIS,
                      provider: provider.name,
                      message:
                        "请使用 TRAE 内置 Vision 能力分析照片，将结果作为 photoAnalysis 参数（JSON 字符串）重新调用。",
                      visionPrompt: err.data.visionPrompt,
                      hint:
                        "分析完成后，调用 q3d_generate_avatar 时传入 photoAnalysis 参数即可继续。",
                    }),
                  },
                ],
                isError: true,
              };
            }
            throw err;
          }
        }

        // Step 2: 构建 prompt 并生成图像
        let imageUrl: string;
        let revisedPrompt: string;

        try {
          // 直接使用 provider.generateAvatar，但需要 prompt
          // 对于 TRAE provider，这会抛出 NEED_IMAGE_GENERATION 信号
          // 对于 external/mock provider，这会返回真实结果
          const styleDesc = STYLE_CONFIG[style]?.name || "kawaii";
          const result = await provider.generateAvatar(
            buildTraeGeneratePrompt(style, analysis, customPrompt),
            styleDesc
          );
          imageUrl = result.imageUrl;
          revisedPrompt = result.revisedPrompt;
        } catch (err: any) {
          // TRAE 协作模式：需要图像生成
          if (err instanceof TraeCollabError &&
              err.signal === TraeCollabSignal.NEED_IMAGE_GENERATION) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    success: false,
                    signal: TraeCollabSignal.NEED_IMAGE_GENERATION,
                    provider: provider.name,
                    message:
                      "请使用 TRAE GenerateImage 工具生成 Q 版头像，将生成的图片路径作为 generatedImagePath 参数重新调用。",
                    imagePrompt: buildTraeGeneratePrompt(
                      style,
                      analysis,
                      customPrompt
                    ),
                    imageSize: "1024x1024",
                    photoAnalysis: analysis,
                    hint:
                      "生成图片后，调用 q3d_generate_avatar 时传入 generatedImagePath 和 photoAnalysis 参数即可保存。",
                  }),
                },
              ],
              isError: true,
            };
          }
          throw err;
        }

        // Step 3: 保存生成的图片
        const outputDir = getSessionPath(config.outputDir, uploadId);
        const avatarPath = path.join(outputDir, "avatar.png");
        await downloadImage(imageUrl, avatarPath);

        // Step 4: 保存 metadata
        const metadata = {
          uploadId,
          originalPath,
          avatarPath,
          style,
          customPrompt: customPrompt || null,
          revisedPrompt,
          photoAnalysis: analysis,
          provider: provider.name,
          generatedAt: new Date().toISOString(),
        };
        const metadataPath = path.join(outputDir, "metadata.json");
        writeJsonFile(metadataPath, metadata);

        // Step 5: 更新作品索引
        addOrUpdateWork(uploadId, {
          status: "avatar_generated",
          style: style as "kawaii" | "guofeng" | "trendy" | "simple",
          styleName: STYLE_CONFIG[style]?.label || "未知风格",
          avatarPath,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  avatarPath,
                  style,
                  metadataPath,
                  provider: provider.name,
                  revisedPrompt,
                  message: `Q 版形象生成完成！保存至: ${avatarPath}`,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        let errorCode = "GENERATE_AVATAR_FAILED";
        let suggestion = "请检查 API 配置和网络连接，或稍后重试";

        if (error.message?.includes("timeout")) {
          errorCode = "GENERATE_AVATAR_API_TIMEOUT";
          suggestion = "AI 生成接口响应超时，请检查网络连接或稍后重试";
        } else if (error.message?.includes("rate limit")) {
          errorCode = "GENERATE_AVATAR_RATE_LIMIT";
          suggestion = "API 调用频率受限，请稍等片刻后重试";
        } else if (error.message?.includes("insufficient_quota")) {
          errorCode = "GENERATE_AVATAR_QUOTA_EXHAUSTED";
          suggestion = "API 账户额度不足，请充值或更换 API Key";
        } else if (error.message?.includes("content_policy_violation")) {
          errorCode = "GENERATE_AVATAR_CONTENT_POLICY";
          suggestion = "图片内容触发了安全策略，请尝试其他照片";
        } else if (error.message?.includes("API key")) {
          errorCode = "GENERATE_AVATAR_API_KEY_INVALID";
          suggestion = "API Key 无效，请检查 .env 配置";
        } else if (error.message?.includes("GENERATE_AVATAR_PROMPT_TOO_LONG")) {
          errorCode = "GENERATE_AVATAR_PROMPT_TOO_LONG";
          suggestion = "自定义提示词过长，请缩短至 200 字符以内";
        } else if (error.message?.includes("GENERATE_AVATAR_PROMPT_INVALID")) {
          errorCode = "GENERATE_AVATAR_PROMPT_INVALID";
          suggestion = "自定义提示词包含无效字符，请使用中文、英文或常见标点";
        } else if (error.message?.includes("Image file not found")) {
          errorCode = "GENERATED_IMAGE_NOT_FOUND";
          suggestion = "提供的 generatedImagePath 路径无效，请检查路径是否正确";
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: {
                  code: errorCode,
                  message: error.message || "形象生成失败",
                  suggestion,
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
