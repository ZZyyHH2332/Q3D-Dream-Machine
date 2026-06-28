import path from "path";
import fs from "fs";
import { config } from "../../../config.js";
import type { Provider3D, Generate3DInput, Generate3DResult } from "./index.js";
import { saveGlb } from "./index.js";

const TRIPO_API_BASE = "https://api.tripo3d.ai/v2/openapi";

async function uploadImageToTripo(
  imagePath: string,
  apiKey: string
): Promise<string> {
  const imageBuffer = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase().replace(".", "");
  const contentType = ext === "jpg" ? "jpeg" : ext === "jpeg" ? "jpeg" : ext;

  const response = await fetch(`${TRIPO_API_BASE}/upload/sts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: (() => {
      const fd = new FormData();
      fd.append(
        "file",
        new Blob([imageBuffer], { type: `image/${contentType}` }),
        path.basename(imagePath)
      );
      return fd;
    })(),
  });

  const result = (await response.json()) as any;
  if (result.code !== 0 || !result.data?.image_token) {
    throw new Error(`Tripo upload failed: ${JSON.stringify(result)}`);
  }
  return result.data.image_token;
}

async function createModelTask(
  imageToken: string,
  apiKey: string
): Promise<string> {
  const response = await fetch(`${TRIPO_API_BASE}/task`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "image_to_model",
      file: { type: "png", file_token: imageToken },
    }),
  });

  const result = (await response.json()) as any;
  if (result.code !== 0 || !result.data?.task_id) {
    throw new Error(`Tripo task creation failed: ${JSON.stringify(result)}`);
  }
  return result.data.task_id;
}

async function pollTask(
  taskId: string,
  apiKey: string,
  timeoutMs = 300000,
  intervalMs = 5000
): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const response = await fetch(`${TRIPO_API_BASE}/task/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const result = (await response.json()) as any;
    const data = result.data;
    if (data.status === "success") {
      return (
        data.output?.model ||
        data.output?.models?.[0]?.url ||
        ""
      );
    }
    if (["failed", "banned", "expired"].includes(data.status)) {
      throw new Error(
        `Tripo task ${data.status}: ${data.error || JSON.stringify(data)}`
      );
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Tripo task timed out after 5 minutes");
}

export const tripoProvider: Provider3D = {
  name: "Tripo3D",

  async isAvailable(): Promise<boolean> {
    return !!config.tripoApiKey;
  },

  async generate(input: Generate3DInput): Promise<Generate3DResult> {
    const apiKey = config.tripoApiKey;
    if (!apiKey) {
      return {
        success: false,
        glbPath: "",
        error: {
          code: "TRIPO_NOT_CONFIGURED",
          message: "未配置 Tripo3D API Key",
          suggestion:
            "请设置环境变量 Q3D_TRIPO_API_KEY（获取地址：https://platform.tripo.ai）",
        },
      };
    }

    try {
      const imageToken = await uploadImageToTripo(input.avatarPath, apiKey);
      const taskId = await createModelTask(imageToken, apiKey);
      const glbUrl = await pollTask(taskId, apiKey);

      if (!glbUrl) {
        return {
          success: false,
          glbPath: "",
          error: {
            code: "TRIPO_NO_GLB_URL",
            message: "3D 模型生成完成但未返回 GLB 下载链接",
          },
        };
      }

      const response = await fetch(glbUrl);
      if (!response.ok) {
        return {
          success: false,
          glbPath: "",
          error: {
            code: "TRIPO_DOWNLOAD_FAILED",
            message: `GLB 下载失败: HTTP ${response.status}`,
          },
        };
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const glbPath = saveGlb(buffer, input.outputDir, input.sessionId);

      return {
        success: true,
        glbPath,
        message: `Tripo3D 生成成功: ${glbPath}`,
      };
    } catch (error: any) {
      const msg = error.message || "";
      if (msg.includes("upload failed")) {
        return {
          success: false,
          glbPath: "",
          error: {
            code: "TRIPO_UPLOAD_FAILED",
            message: msg,
            suggestion: "请检查图片格式和大小是否符合 Tripo3D 要求",
          },
        };
      }
      if (msg.includes("task creation failed")) {
        return {
          success: false,
          glbPath: "",
          error: {
            code: "TRIPO_TASK_FAILED",
            message: msg,
          },
        };
      }
      if (msg.includes("timed out")) {
        return {
          success: false,
          glbPath: "",
          error: {
            code: "TRIPO_TIMEOUT",
            message: msg,
            suggestion: "任务超时，请稍后重试或检查 Tripo3D 服务状态",
          },
        };
      }
      return {
        success: false,
        glbPath: "",
        error: {
          code: "TRIPO_POLL_FAILED",
          message: msg,
        },
      };
    }
  },
};
