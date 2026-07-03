import path from "path";
import fs from "fs";
import { config } from "../../../config.js";

export interface Generate3DInput {
  avatarPath: string;
  sessionId: string;
  outputDir: string;
}

export interface Generate3DResult {
  success: boolean;
  glbPath: string;
  message?: string;
  error?: { code: string; message: string; suggestion?: string };
}

export interface Provider3D {
  name: string;
  isAvailable(): Promise<boolean>;
  generate(input: Generate3DInput): Promise<Generate3DResult>;
}

// Auto-detect and select the best available provider
export async function resolveProvider(): Promise<Provider3D | null> {
  const { soapLocalProvider } = await import("./soap-local.js");
  const { hunyuanProvider } = await import("./hunyuan.js");
  const { sf3dLocalProvider } = await import("./sf3d-local.js");
  const { provider302AI } = await import("./302ai.js");
  const { tripoProvider } = await import("./tripo.js");

  const providerMap: Record<string, Provider3D> = {
    soap: soapLocalProvider,
    hunyuan: hunyuanProvider,
    sf3d: sf3dLocalProvider,
    "302ai": provider302AI,
    tripo: tripoProvider,
  };

  // If a specific provider is requested, try it directly
  if (config.provider3D !== "auto" && providerMap[config.provider3D]) {
    const p = providerMap[config.provider3D];
    if (await p.isAvailable()) {
      return p;
    }
    // If explicitly requested but unavailable, return null (caller handles error)
    return null;
  }

  // Auto mode: try in priority order
  // 1. SOAP 本地（最佳：带骨骼可动画）
  // 2. Hunyuan3D 本地（高质量几何）
  // 3. SF3D 本地（超快速 + PBR 材质）
  // 4. 302AI 云（SF3D 云端版本）
  // 5. Tripo 云（保底）
  const priority = [
    soapLocalProvider,
    hunyuanProvider,
    sf3dLocalProvider,
    provider302AI,
    tripoProvider,
  ];
  for (const p of priority) {
    if (await p.isAvailable()) {
      return p;
    }
  }

  return null;
}

// Helper: save GLB buffer to disk
export function saveGlb(
  buffer: Buffer,
  outputDir: string,
  sessionId: string
): string {
  const glbPath = path.join(outputDir, "model.glb");
  fs.mkdirSync(path.dirname(glbPath), { recursive: true });
  fs.writeFileSync(glbPath, buffer);
  return glbPath;
}
