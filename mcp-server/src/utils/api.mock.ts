import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateAvatar(
  _imageBase64: string,
  style: string,
  customPrompt?: string
): Promise<{ imageUrl: string; revisedPrompt: string }> {
  await delay(100 + Math.random() * 200);
  return {
    imageUrl: "mock://local/test-avatar.png",
    revisedPrompt: `Mock: ${customPrompt || style} chibi avatar`,
  };
}

export async function downloadImage(url: string, destPath: string): Promise<void> {
  if (url.startsWith("mock://")) {
    if (!fs.existsSync(mockImagePath)) {
      // Create a simple mock PNG if not exists
      createMockPng(mockImagePath);
    }
    fs.copyFileSync(mockImagePath, destPath);
    return;
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to download image: ${response.status} ${response.statusText}`
    );
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
}

export async function chatCompletion(
  _messages: ChatMessage[],
  _options?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  await delay(50 + Math.random() * 100);
  const replies = [
    "你好呀！我是小Q，你的专属Q版宠物~ 🎉 [MOCK]",
    "哇，你终于来找我聊天啦！今天心情怎么样？ [MOCK]",
    "嘻嘻，我一直在等着你呢~ [MOCK]",
    "抱抱！你的小Q在这里陪着你哦 [MOCK]",
  ];
  return replies[Math.floor(Math.random() * replies.length)];
}

function createMockPng(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  // Minimal valid PNG: 1x1 pixel, pink (#FF8FAB)
  // PNG signature + IHDR + IDAT + IEND chunks
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.from([
    0x00, 0x00, 0x00, 0x0d, // length
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x01, // width: 1
    0x00, 0x00, 0x00, 0x01, // height: 1
    0x08, 0x02, 0x00, 0x00, 0x00, // bit depth, color type, compression, filter, interlace
    0x90, 0x77, 0x53, 0xde, // CRC (may not be valid but enough for file existence tests)
  ]);
  const idat = Buffer.from([
    0x00, 0x00, 0x00, 0x0d, // length
    0x49, 0x44, 0x41, 0x54, // IDAT
    0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00, 0x00, 0x03, 0x00, 0x01,
    0x00, 0x05, 0xfe, 0xd7, // compressed data + CRC
  ]);
  const iend = Buffer.from([
    0x00, 0x00, 0x00, 0x00,
    0x49, 0x45, 0x4e, 0x44,
    0xae, 0x42, 0x60, 0x82,
  ]);
  fs.writeFileSync(filePath, Buffer.concat([pngSignature, ihdr, idat, iend]));
}
