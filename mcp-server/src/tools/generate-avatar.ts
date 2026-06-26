import path from "path";
import fs from "fs";
import { config, isApiConfigured } from "../config.js";
import {
  generateAvatar as generateAvatarImage,
  downloadImage,
} from "../utils/api.js";
import {
  readFileAsBase64,
  getSessionPath,
  writeJsonFile,
} from "../utils/file.js";

export function registerGenerateAvatar(server: any): void {
  server.registerTool(
    "q3d_generate_avatar",
    "根据上传的照片生成 Q 版 2D 形象",
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
    },
    async (args: {
      uploadId: string;
      style?: string;
      customPrompt?: string;
    }) => {
      try {
        const { uploadId, style = "kawaii", customPrompt } = args;

        // Check API configuration
        if (!isApiConfigured()) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: {
                    code: "API_NOT_CONFIGURED",
                    message: "AI 图像生成 API 未配置",
                    suggestion:
                      "请复制 mcp-server/.env.example 为 .env，填写 Q3D_API_KEY 和 Q3D_API_BASE",
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

        // Generate avatar
        const base64 = readFileAsBase64(originalPath);
        const { imageUrl, revisedPrompt } = await generateAvatarImage(
          base64,
          style,
          customPrompt
        );

        // Save generated image
        const outputDir = getSessionPath(config.outputDir, uploadId);
        const avatarPath = path.join(outputDir, "avatar.png");
        await downloadImage(imageUrl, avatarPath);

        // Save metadata
        const metadata = {
          uploadId,
          originalPath,
          avatarPath,
          style,
          customPrompt: customPrompt || null,
          revisedPrompt,
          generatedAt: new Date().toISOString(),
        };
        const metadataPath = path.join(outputDir, "metadata.json");
        writeJsonFile(metadataPath, metadata);

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
        let suggestion =
          "请检查 API 配置和网络连接，或稍后重试";

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
