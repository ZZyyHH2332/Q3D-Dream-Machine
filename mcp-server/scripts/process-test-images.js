/**
 * 测试图片后处理脚本
 * 调整尺寸、转换格式、重命名为 img-11~20
 */
const fs = require('fs');
const path = require('path');

const RANDOM_DIR = path.join(__dirname, '..', '.test-sandbox', 'test-data', 'random');

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
  // 精确匹配：img-13.jpg / img-13.png 等
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
  console.log('现有文件:', files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f)).join(', '), '\n');
  
  let successCount = 0;
  let skipCount = 0;
  
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
    
    console.log(`  处理: ${sourceFile} -> ${targetFile} (${config.width}x${config.height}, ${config.targetFormat.toUpperCase()})`);
    console.log(`       ${config.desc}`);
    
    try {
      // 使用 sharp 处理图片（如果可用）
      let sharp;
      try {
        sharp = require('sharp');
      } catch (e) {
        // sharp 不可用，使用 canvas 或直接复制（保留原始尺寸）
        console.log(`       ℹ️  sharp 不可用，使用原始尺寸复制`);
      }
      
      if (sharp) {
        await sharp(sourcePath)
          .resize(config.width, config.height, { fit: 'cover' })
          .toFormat(config.targetFormat, { quality: 90 })
          .toFile(targetPath);
      } else {
        // 直接复制，不改变尺寸和格式
        fs.copyFileSync(sourcePath, targetPath);
      }
      
      // 获取文件信息
      const stats = fs.statSync(targetPath);
      const sizeKB = (stats.size / 1024).toFixed(1);
      console.log(`       ✅ 完成 (${sizeKB} KB)`);
      successCount++;
    } catch (err) {
      console.log(`       ❌ 失败: ${err.message}`);
      skipCount++;
    }
  }
  
  console.log(`\n=== 处理完成: ${successCount} 成功, ${skipCount} 跳过 ===`);
  
  // 列出最终的 img-xx 文件
  const finalFiles = fs.readdirSync(RANDOM_DIR)
    .filter(f => /^img-\d+\.(jpg|jpeg|png|webp)$/i.test(f))
    .sort();
  
  console.log(`\n最终测试图片列表 (${finalFiles.length} 张):`);
  for (const f of finalFiles) {
    const stats = fs.statSync(path.join(RANDOM_DIR, f));
    const sizeKB = (stats.size / 1024).toFixed(1);
    console.log(`  ${f} (${sizeKB} KB)`);
  }
}

main().catch(console.error);
