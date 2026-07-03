import { config } from "../../../config.js";
import type { Provider3D, Generate3DInput, Generate3DResult } from "./index.js";
import { saveGlb } from "./index.js";
import fs from "fs";

const SOAP_LOCAL_URL = "http://localhost:8082";

/**
 * SOAP (Style-Omniscient Animatable Portraits) 本地 Provider
 * 
 * 核心能力：单图 → 可驱动 3D 角色（带骨骼绑定）
 * 支持卡通/动漫/写实多风格
 * 输出可直接用于动画驱动（对接骨骼动画系统）
 * 
 * 状态：研究论文阶段，开源代码待发布
 * 当前为预留框架，SOAP 服务可用后自动激活
 */
export const soapLocalProvider: Provider3D = {
  name: "SOAP-Local",

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${SOAP_LOCAL_URL}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async generate(input: Generate3DInput): Promise<Generate3DResult> {
    try {
      const imageBuffer = fs.readFileSync(input.avatarPath);
      const base64 = imageBuffer.toString("base64");

      const res = await fetch(`${SOAP_LOCAL_URL}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64,
          style: "cartoon", // SOAP 支持 cartoon/anime/realistic/pixel
        }),
      });

      if (!res.ok) {
        return {
          success: false,
          glbPath: "",
          error: {
            code: "SOAP_LOCAL_ERROR",
            message: `SOAP 本地服务返回错误: ${res.status}`,
          },
        };
      }

      const glbBuffer = Buffer.from(await res.arrayBuffer());
      const glbPath = saveGlb(glbBuffer, input.outputDir, input.sessionId);

      return {
        success: true,
        glbPath,
        message: `SOAP 本地生成可驱动 3D 角色成功: ${glbPath}`,
      };
    } catch (error: any) {
      return {
        success: false,
        glbPath: "",
        error: {
          code: "SOAP_LOCAL_FAILED",
          message: error.message || "SOAP 本地生成失败",
        },
      };
    }
  },
};
