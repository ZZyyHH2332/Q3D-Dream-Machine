// 冒烟测试 2：测试更多工具
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, '..', 'dist', 'index.js');

const child = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
});

let responseData = '';
let requestId = 0;
let currentTest = 0;

const tests = [
  { name: 'q3d_control_mood list', method: 'tools/call', params: { name: 'q3d_control_mood', arguments: { action: 'list' } } },
  { name: 'q3d_manage_gallery stats', method: 'tools/call', params: { name: 'q3d_manage_gallery', arguments: { action: 'stats' } } },
  { name: 'q3d_pet_care status (new session)', method: 'tools/call', params: { name: 'q3d_pet_care', arguments: { action: 'status', sessionId: 'test-smoke-001' } } },
  { name: 'q3d_pet_care feed', method: 'tools/call', params: { name: 'q3d_pet_care', arguments: { action: 'feed', sessionId: 'test-smoke-001', foodType: 'meal' } } },
  { name: 'q3d_pet_care play', method: 'tools/call', params: { name: 'q3d_pet_care', arguments: { action: 'play', sessionId: 'test-smoke-001', playType: 'ball' } } },
  { name: 'q3d_generate_dream_lattice', method: 'tools/call', params: { name: 'q3d_generate_dream_lattice', arguments: { style: 'kawaii', particleCount: 50, openInBrowser: false } } },
];

function sendRequest(method, params = {}) {
  requestId++;
  const request = {
    jsonrpc: '2.0',
    id: requestId,
    method,
    params,
  };
  child.stdin.write(JSON.stringify(request) + '\n');
}

function runNextTest() {
  if (currentTest >= tests.length) {
    console.log('\n🏁 所有测试完成');
    child.kill();
    process.exit(0);
    return;
  }

  const test = tests[currentTest];
  console.log(`\n🧪 测试 ${currentTest + 1}/${tests.length}: ${test.name}`);
  sendRequest(test.method, test.params);
  currentTest++;
}

// 初始化流程
setTimeout(() => {
  sendRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'smoke-test-2', version: '1.0.0' },
  });
}, 500);

let initialized = false;

child.stdout.on('data', (data) => {
  responseData += data.toString();
  const lines = responseData.split('\n');
  responseData = lines.pop() || '';

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const response = JSON.parse(line);

      // Initialize 响应
      if (response.id === 1 && !initialized) {
        initialized = true;
        console.log('✅ Initialize success');
        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
        setTimeout(runNextTest, 200);
      }

      // 工具调用响应
      if (response.result && response.result.content) {
        try {
          const content = JSON.parse(response.result.content[0]?.text || '{}');

          if (content.success) {
            console.log(`   ✅ 成功`);

            // 打印关键信息
            if (content.moods) console.log(`   心情数量: ${content.total}`);
            if (content.total !== undefined && content.byStatus) console.log(`   作品总数: ${content.total}`);
            if (content.pet) console.log(`   宠物: ${content.pet.name} Lv.${content.pet.level}`);
            if (content.particleCount) console.log(`   粒子数: ${content.particleCount}`);
            if (content.message) console.log(`   ${content.message.slice(0, 60)}`);
          } else {
            console.log(`   ❌ 失败: ${content.error?.message || '未知错误'}`);
          }
        } catch (e) {
          // 非 JSON 内容，忽略
        }

        setTimeout(runNextTest, 100);
      }
    } catch (e) {
      // 解析失败，忽略
    }
  }
});

child.stderr.on('data', (data) => {
  // 忽略 stderr
});

setTimeout(() => {
  console.log('\n⏰ 超时退出');
  child.kill();
  process.exit(1);
}, 15000);
