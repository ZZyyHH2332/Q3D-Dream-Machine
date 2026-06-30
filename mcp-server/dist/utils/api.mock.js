import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mockImagePath = path.join(__dirname, "..", "..", "..", ".test-sandbox", "test-data", "mock-avatar.png");
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
const MOCK_STYLE_PROMPTS = {
    kawaii: "转换为软萌大头Q版风格，头部比例放大至全身1/2以上，眼睛圆润明亮占脸1/3，小鼻子微笑嘴型。默认配色：粉色、奶白色、浅紫色为主色调。线条圆润柔和无锐利棱角。背景纯色或简单几何图案。必须保留原照片发色、发型、眼镜等核心特征。English: soft pastel colors, big sparkling eyes, kawaii anime chibi style, round face, adorable, pink and mint tones",
    guofeng: "转换为国风Q版风格，水墨感清雅含蓄，可含汉服或现代中式穿搭元素。默认配色：青绿、墨黑、宣纸白为主。线条带有书法笔触感飘逸流畅。背景可含淡墨山水或留白。必须保留原照片人物气质和核心面部特征。English: Chinese traditional style, ink wash aesthetics, elegant muted colors, flowing hanfu or modern Chinese fashion, graceful",
    trendy: "转换为潮玩手办风格，类似盲盒玩具质感，高饱和度配色，轮廓锐利。默认配色：霓虹色、金属色、撞色为主。线条清晰硬边阴影分明。背景纯色高对比或渐变。必须保留原照片核心识别特征。English: trendy toy figure style, bold saturated colors, sharp outlines, blind box toy aesthetic, collectible figure look",
    simple: "转换为简约卡通风格，极简几何感，色块平涂无复杂纹理。默认配色：黑白灰加单强调色。线条干净一笔画无多余装饰。背景必须极简无场景元素。保留核心轮廓和发色即可。English: minimalist cartoon style, clean lines, flat colors, geometric shapes, simple and cute, modern illustration",
};
export async function generateAvatar(_imageBase64, style, customPrompt) {
    await delay(100 + Math.random() * 200);
    const styleDesc = MOCK_STYLE_PROMPTS[style] || MOCK_STYLE_PROMPTS.kawaii;
    const mockDescription = "gender: unknown, age: 20s, hair: short black hair, face: round face with bright eyes, clothing: casual wear, expression: smiling, vibe: friendly";
    let revisedPrompt = `A cute Q-version (chibi) character portrait. ${styleDesc}. The character is based on: ${mockDescription}. Big head proportion, small body, adorable expression. Clean light background, high quality digital art, character facing forward.`;
    if (customPrompt) {
        revisedPrompt += ` | User's additional requirements (highest priority): ${customPrompt}. If additional requirements conflict with the default style, follow the additional requirements.`;
    }
    return {
        imageUrl: "mock://local/test-avatar.png",
        revisedPrompt,
    };
}
export async function downloadImage(url, destPath) {
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
        throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(destPath, buffer);
}
export async function chatCompletion(_messages, _options) {
    await delay(50 + Math.random() * 100);
    const replies = [
        "你好呀！我是小Q，你的专属Q版宠物~ 🎉 [MOCK]",
        "哇，你终于来找我聊天啦！今天心情怎么样？ [MOCK]",
        "嘻嘻，我一直在等着你呢~ [MOCK]",
        "抱抱！你的小Q在这里陪着你哦 [MOCK]",
    ];
    return replies[Math.floor(Math.random() * replies.length)];
}
function createMockPng(filePath) {
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
//# sourceMappingURL=api.mock.js.map