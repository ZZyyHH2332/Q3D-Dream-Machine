/**
 * Q3D 真实 API 端到端测试脚本
 * 使用 OpenAI GPT-4o vision + DALL-E 3 生成 Q 版形象
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 加载 .env
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
  const [key, ...rest] = line.split('=');
  if (key && !key.startsWith('#') && rest.length > 0) {
    process.env[key.trim()] = rest.join('=').trim();
  }
});

// 导入 API 模块（从 dist/）
const { generateAvatar, downloadImage } = await import('./dist/utils/api.js');

// 测试图片路径
const testImagePath = path.join(__dirname, '../.test-sandbox/test-data/sample-portrait.jpg');
const outputDir = path.join(__dirname, '../assets/generated/test-real-api');

if (!fs.existsSync(testImagePath)) {
  console.error('测试图片不存在:', testImagePath);
  process.exit(1);
}

// 确保输出目录存在
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 读取图片为 base64
function readFileAsBase64(filePath) {
  return fs.readFileSync(filePath).toString('base64');
}

async function runTest() {
  console.log('========================================');
  console.log('Q3D 真实 API 端到端测试');
  console.log('========================================');
  console.log('测试图片:', testImagePath);
  console.log('图片大小:', (fs.statSync(testImagePath).size / 1024).toFixed(1), 'KB');
  console.log('');

  const base64 = readFileAsBase64(testImagePath);

  // 测试 4 种风格
  const styles = ['kawaii', 'guofeng', 'trendy', 'simple'];

  for (const style of styles) {
    console.log(`\n>>> 正在生成 [${style}] 风格...`);
    const start = Date.now();
    try {
      const result = await generateAvatar(base64, style);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`    耗时: ${elapsed}s`);
      console.log(`    图片 URL: ${result.imageUrl.substring(0, 80)}...`);
      console.log(`    Revised Prompt: ${result.revisedPrompt.substring(0, 100)}...`);

      // 下载图片
      const destPath = path.join(outputDir, `avatar-${style}.png`);
      await downloadImage(result.imageUrl, destPath);
      console.log(`    已保存: ${destPath}`);
    } catch (err) {
      console.error(`    失败: ${err.message}`);
    }
  }

  console.log('\n========================================');
  console.log('测试完成！输出目录:', outputDir);
  console.log('========================================');
}

runTest().catch(err => {
  console.error('测试脚本异常:', err);
  process.exit(1);
});
