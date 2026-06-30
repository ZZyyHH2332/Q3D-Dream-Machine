/**
 * prepare-random-images.mjs
 * 从用户上传目录读取10张随机图片，规范化复制为 img-01.jpg ~ img-10.jpg
 * 用法: node .test-sandbox/prepare-random-images.mjs [上传目录路径]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 默认上传目录，可通过命令行参数覆盖
const uploadsDir = process.argv[2] || "d:\\Trae CN\\.uploads";
const outputDir = path.join(__dirname, "test-data", "random");

// 确保输出目录
fs.mkdirSync(outputDir, { recursive: true });

// 清理旧文件
const oldFiles = fs.readdirSync(outputDir).filter(f => /^img-\d{2}\./.test(f));
oldFiles.forEach(f => fs.unlinkSync(path.join(outputDir, f)));

// 读取上传文件（支持 jpg/png/webp）
const allFiles = fs.readdirSync(uploadsDir)
  .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
  .sort();

if (allFiles.length === 0) {
  console.error(`错误：在 ${uploadsDir} 中未找到图片文件`);
  console.error(`支持格式：jpg, jpeg, png, webp`);
  process.exit(1);
}

if (allFiles.length < 10) {
  console.error(`错误：需要 10 张图片，当前仅 ${allFiles.length} 张`);
  console.error(`请在 ${uploadsDir} 中放入更多图片`);
  process.exit(1);
}

// 取前10张
const files = allFiles.slice(0, 10);
let validCount = 0;
const warnings = [];

// 规范化复制
files.forEach((f, i) => {
  const ext = path.extname(f).toLowerCase();
  const destName = `img-${String(i + 1).padStart(2, "0")}${ext}`;
  const dest = path.join(outputDir, destName);
  fs.copyFileSync(path.join(uploadsDir, f), dest);

  // 验证文件大小 < 4MB（upload-photo.ts 限制）
  const stat = fs.statSync(dest);
  const sizeMB = stat.size / 1024 / 1024;
  if (sizeMB > 4) {
    warnings.push(`img-${String(i + 1).padStart(2, "0")}: ${sizeMB.toFixed(1)}MB 超过 4MB 限制`);
  } else {
    validCount++;
  }

  console.log(`[${String(i + 1).padStart(2, "0")}/10] ${f} -> ${destName} (${sizeMB.toFixed(1)}MB)`);
});

console.log(`\n已准备 ${files.length} 张测试图片至 ${outputDir}`);
console.log(`有效: ${validCount}/${files.length}`);

if (warnings.length > 0) {
  console.warn(`\n警告:`);
  warnings.forEach(w => console.warn(`  - ${w}`));
  console.warn(`超大图片可能导致 upload-photo 工具拒绝，建议压缩后重新运行`);
}
