/**
 * Mock Avatar Provider — Mock 模式实现
 * 从原 api.mock.ts 中拆分出来，实现 IAvatarProvider 接口
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  IAvatarProvider,
  PhotoAnalysis,
  ChatMessage,
  ChatOptions,
  AvatarGenerateResult,
} from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mockImagePath = path.join(
  __dirname,
  "..",
  "..",
  "..",
  ".test-sandbox",
  "test-data",
  "mock-avatar.png"
);

const MOCK_STYLE_PROMPTS: Record<string, string> = {
  kawaii:
    "转换为软萌大头Q版风格，头部比例放大至全身1/2以上，眼睛圆润明亮占脸1/3，小鼻子微笑嘴型。默认配色：粉色、奶白色、浅紫色为主色调。线条圆润柔和无锐利棱角。背景纯色或简单几何图案。必须保留原照片发色、发型、眼镜等核心特征。English: soft pastel colors, big sparkling eyes, kawaii anime chibi style, round face, adorable, pink and mint tones",
  guofeng:
    "转换为国风Q版风格，水墨感清雅含蓄，可含汉服或现代中式穿搭元素。默认配色：青绿、墨黑、宣纸白为主。线条带有书法笔触感飘逸流畅。背景可含淡墨山水或留白。必须保留原照片人物气质和核心面部特征。English: Chinese traditional style, ink wash aesthetics, elegant muted colors, flowing hanfu or modern Chinese fashion, graceful",
  trendy:
    "转换为潮玩手办风格，类似盲盒玩具质感，高饱和度配色，轮廓锐利。默认配色：霓虹色、金属色、撞色为主。线条清晰硬边阴影分明。背景纯色高对比或渐变。必须保留原照片核心识别特征（发型、眼镜、标志性配饰）。English: trendy toy figure style, bold saturated colors, sharp outlines, blind box toy aesthetic, collectible figure look",
  simple:
    "转换为简约卡通风格，极简几何感，色块平涂无复杂纹理。默认配色：黑白灰加单强调色。线条干净一笔画无多余装饰。背景必须极简无场景元素。保留核心轮廓和发色即可，细节可简化。English: minimalist cartoon style, clean lines, flat colors, geometric shapes, simple and cute, modern illustration",
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createMockPng(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  // Minimal valid PNG: 1x1 pixel, pink (#FF8FAB)
  const pngSignature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const ihdr = Buffer.from([
    0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01,
    0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00,
    0x90, 0x77, 0x53, 0xde,
  ]);
  const idat = Buffer.from([
    0x00, 0x00, 0x00, 0x0d,
    0x49, 0x44, 0x41, 0x54,
    0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00, 0x00, 0x03, 0x00, 0x01,
    0x00, 0x05, 0xfe, 0xd7,
  ]);
  const iend = Buffer.from([
    0x00, 0x00, 0x00, 0x00,
    0x49, 0x45, 0x4e, 0x44,
    0xae, 0x42, 0x60, 0x82,
  ]);
  fs.writeFileSync(filePath, Buffer.concat([pngSignature, ihdr, idat, iend]));
}

export const mockAvatarProvider: IAvatarProvider = {
  name: "mock",

  isAvailable(): boolean {
    return true; // Mock 总是可用
  },

  async analyzePhoto(_imageBase64: string): Promise<PhotoAnalysis> {
    await delay(50 + Math.random() * 100);
    return {
      gender: "unknown",
      ageRange: "20s",
      hair: { style: "short black hair", color: "black" },
      eyes: { color: "brown", size: "medium" },
      facialFeatures: { faceShape: "round" },
      outfit: { top: "casual wear", bottom: "jeans" },
      accessories: [],
      expression: "smiling",
      overallVibe: "friendly",
    };
  },

  async analyzePhotoWithModel(
    _imageBase64: string,
    model: string
  ): Promise<PhotoAnalysis> {
    await delay(50 + Math.random() * 100);
    console.log(`[mock] analyzePhotoWithModel called with model: ${model}`);
    return {
      gender: "unknown",
      ageRange: "20s",
      hair: { style: "short black hair", color: "black" },
      eyes: { color: "brown", size: "medium" },
      facialFeatures: { faceShape: "round" },
      outfit: { top: "casual wear", bottom: "jeans" },
      accessories: [],
      expression: "smiling",
      overallVibe: "friendly",
    };
  },

  async optimizePromptWithModel(
    analysis: PhotoAnalysis,
    style: string,
    model: string
  ): Promise<string> {
    await delay(50 + Math.random() * 100);
    console.log(`[mock] optimizePromptWithModel called with model: ${model}`);
    const hairDesc = analysis.hair?.style || "short hair";
    const outfitDesc = analysis.outfit?.top || "casual wear";
    const faceDesc = analysis.facialFeatures?.faceShape || "round face";
    return `A cute chibi character with ${faceDesc}, ${hairDesc}, ${outfitDesc}, ${analysis.expression}. Style: ${style}, Q-version, cartoon, anime. High quality, detailed, professional, masterpiece. 3D render, soft lighting, smooth skin. [MOCK OPTIMIZED]`;
  },

  async generateAvatar(
    prompt: string,
    style: string
  ): Promise<AvatarGenerateResult> {
    await delay(100 + Math.random() * 200);
    const styleDesc =
      MOCK_STYLE_PROMPTS[style] || MOCK_STYLE_PROMPTS.kawaii;
    const revisedPrompt =
      prompt ||
      `A cute Q-version (chibi) character portrait. ${styleDesc}. Mock generated.`;
    return {
      imageUrl: "mock://local/test-avatar.png",
      revisedPrompt,
    };
  },

  async chatCompletion(
    _messages: ChatMessage[],
    _options?: ChatOptions
  ): Promise<string> {
    await delay(50 + Math.random() * 100);
    const replies = [
      "你好呀！我是小Q，你的专属Q版宠物~ 🎉 [MOCK]",
      "哇，你终于来找我聊天啦！今天心情怎么样？ [MOCK]",
      "嘻嘻，我一直在等着你呢~ [MOCK]",
      "抱抱！你的小Q在这里陪着你哦 [MOCK]",
    ];
    return replies[Math.floor(Math.random() * replies.length)];
  },
};

/**
 * 下载 mock 图片（从 mock 路径复制到目标路径）
 * 与 api.mock.ts 的 downloadImage 功能一致，供外部使用
 */
export function downloadMockImage(
  url: string,
  destPath: string
): void {
  if (url.startsWith("mock://")) {
    if (!fs.existsSync(mockImagePath)) {
      createMockPng(mockImagePath);
    }
    fs.copyFileSync(mockImagePath, destPath);
  }
}
