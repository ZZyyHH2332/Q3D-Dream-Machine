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
  const { hunyuanProvider } = await import("./hunyuan.js");
  const { provider302AI } = await import("./302ai.js");
  const { tripoProvider } = await import("./tripo.js");

  const providerMap: Record<string, Provider3D> = {
    hunyuan: hunyuanProvider,
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
  const priority = [hunyuanProvider, provider302AI, tripoProvider];
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
