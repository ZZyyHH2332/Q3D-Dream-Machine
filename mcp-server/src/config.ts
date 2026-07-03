import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from mcp-server directory
dotenv.config({ path: path.join(__dirname, "..", ".env") });

export type Provider3D = "hunyuan" | "tripo" | "302ai" | "auto";
export type AiProvider = "trae" | "external" | "auto";

export interface Q3DConfig {
  aiProvider: AiProvider;
  traeVisionEnabled: boolean;
  traeImageModel: string;
  apiKey: string | undefined;
  apiBase: string;
  outputDir: string;
  uploadsDir: string;
  worksIndexPath: string;
  testMode: boolean;
  defaultStyle: string;
  provider3D: Provider3D;
  hunyuanApiUrl: string;
  api302Key: string | undefined;
  tripoApiKey: string | undefined;
  sf3dLocalUrl: string;
  soapLocalUrl: string;
}

function getConfig(): Q3DConfig {
  const projectRoot = path.join(__dirname, "..", "..");

  const aiProviderRaw = (process.env.Q3D_AI_PROVIDER || "auto").toLowerCase();
  const aiProvider: AiProvider = ["trae", "external", "auto"].includes(aiProviderRaw)
    ? (aiProviderRaw as AiProvider)
    : "auto";

  return {
    aiProvider,
    traeVisionEnabled: process.env.Q3D_TRAE_VISION_ENABLED !== "false",
    traeImageModel: process.env.Q3D_TRAE_IMAGE_MODEL || "auto",
    apiKey: process.env.Q3D_API_KEY || undefined,
    apiBase: process.env.Q3D_API_BASE || "https://api.openai.com/v1",
    outputDir: process.env.Q3D_OUTPUT_DIR
      ? path.resolve(process.env.Q3D_OUTPUT_DIR)
      : path.join(projectRoot, "assets", "generated"),
    uploadsDir: process.env.Q3D_UPLOADS_DIR
      ? path.resolve(process.env.Q3D_UPLOADS_DIR)
      : path.join(projectRoot, "assets", "uploads"),
    worksIndexPath: process.env.Q3D_WORKS_INDEX
      ? path.resolve(process.env.Q3D_WORKS_INDEX)
      : path.join(projectRoot, "works-index.json"),
    testMode: process.env.Q3D_TEST_MODE === "mock",
    defaultStyle: process.env.Q3D_DEFAULT_STYLE || "kawaii",
    provider3D: (process.env.Q3D_3D_PROVIDER as Provider3D) || "auto",
    hunyuanApiUrl: process.env.Q3D_HUNYUAN_API_URL || "http://localhost:8080",
    api302Key: process.env.Q3D_302AI_API_KEY || undefined,
    tripoApiKey: process.env.Q3D_TRIPO_API_KEY || undefined,
    sf3dLocalUrl: process.env.Q3D_SF3D_LOCAL_URL || "http://localhost:8081",
    soapLocalUrl: process.env.Q3D_SOAP_LOCAL_URL || "http://localhost:8082",
  };
}

// Dynamic config: re-reads process.env on every property access
// This allows runtime changes (e.g., Q3D_TEST_MODE) to take effect immediately
function createConfigProxy(): Q3DConfig {
  return new Proxy({} as Q3DConfig, {
    get(_target, prop: string | symbol) {
      return getConfig()[prop as keyof Q3DConfig];
    },
    set(_target, prop: string | symbol, value: any) {
      // Allow setting properties on the underlying config for flexibility
      (getConfig() as any)[prop] = value;
      return true;
    },
  });
}

export const config = createConfigProxy();

/**
 * 检测是否运行在 TRAE IDE 环境中
 * 通过检查 TRAE 相关的环境变量来判断
 */
export function isTraeEnvironment(): boolean {
  return !!(
    process.env.TRAE ||
    process.env.TRAE_IDE ||
    process.env.TRAE_ENV ||
    process.env.TRAE_WORKSPACE ||
    process.env.TRAE_MCP_CONTEXT
  );
}

/**
 * TRAE Native 模式是否可用
 * 需要同时满足：配置允许 + 运行在 TRAE 环境中
 */
export function isTraeNativeAvailable(): boolean {
  if (config.testMode) return false;
  if (config.aiProvider === "external") return false;
  return isTraeEnvironment();
}

/**
 * AI 能力是否已配置
 * - TRAE Native 可用时返回 true
 * - 外部 API Key 已配置时返回 true
 * - mock 模式下也返回 true
 */
export function isApiConfigured(): boolean {
  if (config.testMode) return true;
  if (isTraeNativeAvailable()) return true;
  return !!config.apiKey;
}
