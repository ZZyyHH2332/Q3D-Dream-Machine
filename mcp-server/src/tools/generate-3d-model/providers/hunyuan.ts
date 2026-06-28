import { config } from "../../../config.js";
import type { Provider3D, Generate3DInput, Generate3DResult } from "./index.js";
import { saveGlb } from "./index.js";
import fs from "fs";

export const hunyuanProvider: Provider3D = {
  name: "Hunyuan3D",

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(config.hunyuanApiUrl, {
        method: "GET",
        signal: AbortSignal.timeout(3000),
      });
      return res.ok || res.status === 404; // 404 means server is up but endpoint differs
    } catch {
      return false;
    }
  },

  async generate(input: Generate3DInput): Promise<Generate3DResult> {
    try {
      const imageBuffer = fs.readFileSync(input.avatarPath);
      const base64 = imageBuffer.toString("base64");

      const res = await fetch(`${config.hunyuanApiUrl}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64,
          format: "glb",
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        return {
          success: false,
          glbPath: "",
          error: {
            code: "HUNYUAN_API_ERROR",
            message: `Hunyuan3D API 返回错误: ${res.status} - ${err}`,
            suggestion: "请检查 Hunyuan3D 本地服务是否正常运行",
          },
        };
      }

      const glbBuffer = Buffer.from(await res.arrayBuffer());
      const glbPath = saveGlb(glbBuffer, input.outputDir, input.sessionId);

      return {
        success: true,
        glbPath,
        message: `Hunyuan3D 本地服务生成成功: ${glbPath}`,
      };
    } catch (error: any) {
      return {
        success: false,
        glbPath: "",
        error: {
          code: "HUNYUAN_GENERATE_FAILED",
          message: error.message || "Hunyuan3D 生成失败",
          suggestion:
            "请确认 Hunyuan3D 本地服务已启动（python api_server.py），或切换至其他 Provider",
        },
      };
    }
  },
};
