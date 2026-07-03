import { config } from "../../../config.js";
import type { Provider3D, Generate3DInput, Generate3DResult } from "./index.js";
import { saveGlb } from "./index.js";
import fs from "fs";

const SF3D_LOCAL_URL = "http://localhost:8081";

export const sf3dLocalProvider: Provider3D = {
  name: "SF3D-Local",

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(SF3D_LOCAL_URL, {
        method: "GET",
        signal: AbortSignal.timeout(3000),
      });
      // Server responds (even 404 means it's running)
      return res.ok || res.status === 404 || res.status === 405;
    } catch {
      return false;
    }
  },

  async generate(input: Generate3DInput): Promise<Generate3DResult> {
    try {
      const imageBuffer = fs.readFileSync(input.avatarPath);
      const base64 = imageBuffer.toString("base64");

      const res = await fetch(`${SF3D_LOCAL_URL}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });

      if (!res.ok) {
        return {
          success: false,
          glbPath: "",
          error: {
            code: "SF3D_LOCAL_ERROR",
            message: `SF3D 本地服务返回错误: ${res.status}`,
          },
        };
      }

      const glbBuffer = Buffer.from(await res.arrayBuffer());
      const glbPath = saveGlb(glbBuffer, input.outputDir, input.sessionId);

      return {
        success: true,
        glbPath,
        message: `SF3D 本地高速生成成功 (~0.5s): ${glbPath}`,
      };
    } catch (error: any) {
      return {
        success: false,
        glbPath: "",
        error: {
          code: "SF3D_LOCAL_FAILED",
          message: error.message || "SF3D 本地生成失败",
        },
      };
    }
  },
};
