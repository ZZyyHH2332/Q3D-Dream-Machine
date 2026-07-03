/**
 * 测试图片后处理脚本
 * 调整尺寸、转换格式、重命名为 img-11~20
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RANDOM_DIR = path.join(__dirname, '..', '..', '.test-sandbox', 'test-data', 'random');

// 图片配置：源文件匹配 -> 目标配置
const IMAGE_CONFIGS = [
  {
    sourceMatch: 'img-11-anime',
    targetName: 'img-11',
    targetFormat: 'png',
    width: 800,
    height: 800,
    desc: '人像-卡通（日系动漫风）'
  },
  {
    sourceMatch: 'img-12-sketch',
    targetName: 'img-12',
    targetFormat: 'jpg',
    width: 600,
    height: 800,
    desc: '人像-素描（铅笔素描）'
  },
  {
    sourceMatch: 'img-13',
    targetName: 'img-13',
    targetFormat: 'png',
    width: 1024,
    height: 1024,
    desc: '人像-3D渲染（Pixar风格）'
  },
  {
    sourceMatch: 'img-14-fullbody',
    targetName: 'img-14',
    targetFormat: 'jpg',
    width: 600,
    height: 1200,
    desc: '全身照（真实照片）'
  },
  {
    sourceMatch: 'img-15-groupphoto',
    targetName: 'img-15',
    targetFormat: 'jpg',
    width: 1200,
    height: 800,
    desc: '多人合影（真实照片）'
  },
  {
    sourceMatch: 'img-16-cat',
    targetName: 'img-16',
    targetFormat: 'jpg',
    width: 500,
    height: 500,
    desc: '动物-猫（真实照片）'
  },
  {
    sourceMatch: 'img-17-dogcartoon',
    targetName: 'img-17',
    targetFormat: 'png',
    width: 700,
    height: 700,
    desc: '动物-狗（卡通插画）'
  },
  {
    sourceMatch: 'img-18-landscape',
    targetName: 'img-18',
    targetFormat: 'jpg',
    width: 1920,
    height: 1080,
    desc: '风景照（真实照片）'
  },
  {
    sourceMatch: 'img-19-toy',
    targetName: 'img-19',
    targetFormat: 'webp',
    width: 400,
    height: 400,
    desc: '物品-玩具（产品摄影）'
  },
  {
    sourceMatch: 'img-20-abstract',
    targetName: 'img-20',
    targetFormat: 'png',
    width: 2048,
    height: 2048,
    desc: '抽象/艺术（数字艺术）'
  }
];

function findSourceFile(sourceMatch) {
  const files = fs.readdirSync(RANDOM_DIR);
  // 精确匹配
  const exactMatch = files.find(f => f.startsWith(sourceMatch + '.') && 
    /\.(jpg|jpeg|png|webp)$/i.test(f));
  if (exactMatch) return exactMatch;
  // 模糊匹配
  const fuzzyMatch = files.find(f => f.includes(sourceMatch) && 
    /\.(jpg|jpeg|png|webp)$/i.test(f));
  return fuzzyMatch || null;
}

async function main() {
  console.log('=== Q3D 测试图片后处理 ===\n');
  console.log('目录:', RANDOM_DIR);
  
  const files = fs.readdirSync(RANDOM_DIR);
  console.log('现有图片文件:');
  files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f)).forEach(f => {
    const stats = fs.statSync(path.join(RANDOM_DIR, f));
    const sizeKB = (stats.size / 1024).toFixed(1);
    console.log(`  ${f} (${sizeKB} KB)`);
  });
  console.log('');
  
  let successCount = 0;
  let skipCount = 0;
  
  // 尝试加载 sharp
  let sharp = null;
  try {
    const sharpModule = await import('sharp');
    sharp = sharpModule.default;
    console.log('ℹ️  使用 sharp 进行图片处理\n');
  } catch (e) {
    console.log('ℹ️  sharp 不可用，直接复制文件（保留原始格式和尺寸）\n');
  }
  
  for (const config of IMAGE_CONFIGS) {
    const sourceFile = findSourceFile(config.sourceMatch);
    
    if (!sourceFile) {
      console.log(`  ⚠️  未找到源文件: ${config.sourceMatch} (跳过)`);
      skipCount++;
      continue;
    }
    
    const sourcePath = path.join(RANDOM_DIR, sourceFile);
    const targetFile = `${config.targetName}.${config.targetFormat}`;
    const targetPath = path.join(RANDOM_DIR, targetFile);
    
    process.stdout.write(`  处理: ${sourceFile} -> ${targetFile} `);
    
    try {
      if (sharp) {
        await sharp(sourcePath)
          .resize(config.width, config.height, { fit: 'cover' })
          .toFormat(config.targetFormat, { quality: 90 })
          .toFile(targetPath);
      } else {
        // 直接复制（如果目标格式不同，先尝试用 canvas 转换，否则就复制）
        const sourceExt = path.extname(sourceFile).toLowerCase().replace('.', '');
        if (sourceExt === config.targetFormat || 
            (sourceExt === 'jpeg' && config.targetFormat === 'jpg') ||
            (sourceExt === 'jpg' && config.targetFormat === 'jpeg')) {
          fs.copyFileSync(sourcePath, targetPath);
        } else {
          // 格式不同但没有 sharp，就复制为原格式并加后缀
          const altTarget = `${config.targetName}.${sourceExt}`;
          fs.copyFileSync(sourcePath, path.join(RANDOM_DIR, altTarget));
          console.log(`(格式: ${sourceExt}，因无转换工具保留原格式)`);
          successCount++;
          const stats = fs.statSync(path.join(RANDOM_DIR, altTarget));
          const sizeKB = (stats.size / 1024).toFixed(1);
          console.log(`    ✅  ${altTarget} (${sizeKB} KB) — ${config.desc}`);
          continue;
        }
      }
      
      const stats = fs.statSync(targetPath);
      const sizeKB = (stats.size / 1024).toFixed(1);
      console.log(`(${config.width}x${config.height})`);
      console.log(`    ✅  完成 (${sizeKB} KB) — ${config.desc}`);
      successCount++;
    } catch (err) {
      console.log(`\n    ❌ 失败: ${err.message}`);
      skipCount++;
    }
  }
  
  console.log(`\n=== 处理完成: ${successCount} 成功, ${skipCount} 跳过 ===`);
  
  // 列出最终的 img-xx 文件
  const finalFiles = fs.readdirSync(RANDOM_DIR)
    .filter(f => /^img-\d+\.(jpg|jpeg|png|webp)$/i.test(f))
    .sort((a, b) => {
      const numA = parseInt(a.match(/img-(\d+)/)?.[1] || '0');
      const numB = parseInt(b.match(/img-(\d+)/)?.[1] || '0');
      return numA - numB;
    });
  
  console.log(`\n最终测试图片列表 (${finalFiles.length} 张):`);
  for (const f of finalFiles) {
    const stats = fs.statSync(path.join(RANDOM_DIR, f));
    const sizeKB = (stats.size / 1024).toFixed(1);
    console.log(`  ${f} (${sizeKB} KB)`);
  }
}

main().catch(console.error);
