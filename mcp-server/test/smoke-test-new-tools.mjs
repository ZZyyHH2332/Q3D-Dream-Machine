// 冒烟测试：验证 MCP Server 启动并注册了 15 个工具
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

function sendRequest(method, params = {}) {
  requestId++;
  const request = {
    jsonrpc: '2.0',
    id: requestId,
    method,
    params,
  };
  const json = JSON.stringify(request) + '\n';
  child.stdin.write(json);
}

// 等待初始化
setTimeout(() => {
  // 1. 发送 initialize
  sendRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'smoke-test', version: '1.0.0' },
  });
}, 500);

let initialized = false;

child.stdout.on('data', (data) => {
  responseData += data.toString();

  // 尝试解析 JSON-RPC 响应（每行一个）
  const lines = responseData.split('\n');
  responseData = lines.pop() || '';

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const response = JSON.parse(line);

      if (response.id === 1 && !initialized) {
        initialized = true;
        console.log('✅ Initialize success');
        console.log(`   Server: ${response.result?.serverInfo?.name} v${response.result?.serverInfo?.version}`);

        // 2. 发送 initialized notification
        const notif = JSON.stringify({
          jsonrpc: '2.0',
          method: 'notifications/initialized',
        }) + '\n';
        child.stdin.write(notif);

        // 3. 请求工具列表
        setTimeout(() => {
          sendRequest('tools/list');
        }, 200);
      }

      if (response.method === 'tools/list' || (response.result && response.result.tools)) {
        const tools = response.result?.tools || [];
        console.log(`\n📋 已注册工具数量: ${tools.length}`);
        console.log('工具列表:');
        tools.forEach((tool, i) => {
          console.log(`  ${String(i + 1).padStart(2, ' ')}. ${tool.name}`);
        });

        // 检查是否有 15 个工具
        if (tools.length >= 15) {
          console.log('\n✅ 所有工具注册成功（15+）');
        } else {
          console.log(`\n⚠️  工具数量不足 15（当前 ${tools.length}）`);
        }

        // 测试 q3d_get_project_info
        console.log('\n🧪 测试 q3d_get_project_info...');
        sendRequest('tools/call', {
          name: 'q3d_get_project_info',
          arguments: { infoType: 'tools' },
        });
      }

      // q3d_get_project_info 响应
      if (response.id && response.result && response.result.content) {
        try {
          const content = JSON.parse(response.result.content[0]?.text || '{}');
          if (content.tools) {
            console.log(`   工具分类总数: ${content.tools.total}`);
            console.log('   分类:');
            for (const [cat, list] of Object.entries(content.tools.categories)) {
              console.log(`     - ${cat}: ${list.length} 个`);
            }
            console.log('✅ q3d_get_project_info 正常');
          }
        } catch (e) {
          // 不是 project info 的响应，忽略
        }

        // 测试 q3d_control_mood list
        if (content.success && content.moods) {
          console.log(`\n✅ q3d_control_mood 正常，可用心情: ${content.total} 种`);
        }
      }
    } catch (e) {
      // 解析失败，可能是不完整的行
    }
  }
});

child.stderr.on('data', (data) => {
  console.error('STDERR:', data.toString());
});

// 5 秒后退出
setTimeout(() => {
  console.log('\n🏁 冒烟测试完成');
  child.kill();
  process.exit(0);
}, 3000);
