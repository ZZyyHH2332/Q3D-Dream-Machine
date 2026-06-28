/**
 * Q3D Blender Bridge Server
 * 本地桥接服务器：Web 页面 <-> Blender (via BlenderMCP addon)
 *
 * 启动: node bridge/q3d-blender-bridge.js
 * 端口: 8766 (HTTP) / 8767 (WebSocket)
 */

const express = require('express');
const cors = require('cors');
const { spawn, exec } = require('child_process');
const net = require('net');
const path = require('path');
const fs = require('fs');
const os = require('os');

const HTTP_PORT = 8766;
const BLENDER_PORT = 9876;  // BlenderMCP addon default
const BLENDER_HOST = 'localhost';

const app = express();
app.use(cors());
app.use(express.json());

let blenderProcess = null;
let blenderConnected = false;
let blenderSocket = null;

// ==================== Blender 路径检测 ====================

function findBlenderPath() {
  const platform = os.platform();

  if (platform === 'win32') {
    // 常见安装路径
    const candidates = [
      'C:\\Program Files\\Blender Foundation\\Blender 4.4\\blender.exe',
      'C:\\Program Files\\Blender Foundation\\Blender 4.3\\blender.exe',
      'C:\\Program Files\\Blender Foundation\\Blender 4.2\\blender.exe',
      'C:\\Program Files\\Blender Foundation\\Blender 4.1\\blender.exe',
      'C:\\Program Files\\Blender Foundation\\Blender 4.0\\blender.exe',
      'C:\\Program Files\\Blender Foundation\\Blender 3.6\\blender.exe',
      'C:\\Program Files\\Blender Foundation\\Blender 3.5\\blender.exe',
      'C:\\Program Files\\Blender Foundation\\Blender 3.0\\blender.exe',
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }

    // 检查 PATH
    const pathDirs = (process.env.PATH || '').split(';');
    for (const dir of pathDirs) {
      const p = path.join(dir, 'blender.exe');
      if (fs.existsSync(p)) return p;
    }

    // 检查 Program Files 下的 Blender Foundation
    try {
      const baseDir = 'C:\\Program Files\\Blender Foundation';
      if (fs.existsSync(baseDir)) {
        const dirs = fs.readdirSync(baseDir).filter(d => d.toLowerCase().startsWith('blender'));
        if (dirs.length > 0) {
          dirs.sort().reverse();
          const p = path.join(baseDir, dirs[0], 'blender.exe');
          if (fs.existsSync(p)) return p;
        }
      }
    } catch (e) { /* ignore */ }
  } else if (platform === 'darwin') {
    const candidates = [
      '/Applications/Blender.app/Contents/MacOS/Blender',
      '/usr/local/bin/blender',
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
  } else {
    const candidates = [
      '/usr/bin/blender',
      '/usr/local/bin/blender',
      '/snap/bin/blender',
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
  }

  return null;
}

// ==================== Socket 客户端 ====================

function connectToBlenderSocket() {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.setTimeout(5000);

    socket.on('connect', () => {
      console.log('[Bridge] Connected to Blender MCP addon');
      blenderSocket = socket;
      blenderConnected = true;
      resolve(socket);
    });

    socket.on('error', (err) => {
      blenderConnected = false;
      reject(err);
    });

    socket.on('close', () => {
      blenderConnected = false;
      blenderSocket = null;
      console.log('[Bridge] Blender socket closed');
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('Connection timeout'));
    });

    socket.connect(BLENDER_PORT, BLENDER_HOST);
  });
}

function sendCommandToBlender(command) {
  return new Promise((resolve, reject) => {
    if (!blenderSocket || !blenderConnected) {
      reject(new Error('Blender not connected'));
      return;
    }

    const data = JSON.stringify(command);
    blenderSocket.write(data + '\n');

    let response = '';
    const onData = (chunk) => {
      response += chunk.toString();
      try {
        const lines = response.split('\n').filter(l => l.trim());
        for (const line of lines) {
          const result = JSON.parse(line);
          blenderSocket.off('data', onData);
          resolve(result);
          return;
        }
      } catch (e) {
        // 等待更多数据
      }
    };

    blenderSocket.on('data', onData);

    setTimeout(() => {
      blenderSocket.off('data', onData);
      reject(new Error('Command timeout'));
    }, 30000);
  });
}

// ==================== HTTP API ====================

// 健康检查
app.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    blenderConnected,
    blenderPid: blenderProcess ? blenderProcess.pid : null,
    blenderPath: findBlenderPath(),
    uptime: process.uptime(),
  });
});

// 启动 Blender
app.post('/launch-blender', async (req, res) => {
  if (blenderProcess) {
    return res.json({ success: true, message: 'Blender already running', pid: blenderProcess.pid });
  }

  const blenderPath = findBlenderPath();
  if (!blenderPath) {
    return res.status(404).json({
      success: false,
      error: 'Blender not found. Please install Blender 3.0+ or set BLENDER_PATH env variable.',
    });
  }

  try {
    const addonPath = path.join(__dirname, '..', 'third_party', 'blender-mcp', 'addon.py');
    const args = [];

    // 如果 addon.py 存在，自动加载
    if (fs.existsSync(addonPath)) {
      args.push('--python', addonPath);
    }

    blenderProcess = spawn(blenderPath, args, {
      detached: false,
      windowsHide: false,  // Windows 下显示 Blender 窗口
    });

    console.log(`[Bridge] Blender launched: ${blenderPath} (PID: ${blenderProcess.pid})`);

    blenderProcess.on('exit', (code) => {
      console.log(`[Bridge] Blender exited with code ${code}`);
      blenderProcess = null;
      blenderConnected = false;
      blenderSocket = null;
    });

    blenderProcess.on('error', (err) => {
      console.error('[Bridge] Blender process error:', err);
      blenderProcess = null;
    });

    // 等待 addon 启动
    let attempts = 0;
    const maxAttempts = 30;
    const checkConnection = async () => {
      try {
        await connectToBlenderSocket();
        return true;
      } catch (e) {
        attempts++;
        if (attempts >= maxAttempts) return false;
        await new Promise(r => setTimeout(r, 1000));
        return checkConnection();
      }
    };

    const connected = await checkConnection();

    res.json({
      success: true,
      pid: blenderProcess.pid,
      connected,
      blenderPath,
      addonLoaded: fs.existsSync(addonPath),
    });
  } catch (err) {
    console.error('[Bridge] Launch error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 发送命令到 Blender
app.post('/send-command', async (req, res) => {
  try {
    if (!blenderConnected) {
      // 尝试重连
      await connectToBlenderSocket();
    }
    const result = await sendCommandToBlender(req.body);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 执行 Python 代码
app.post('/execute-python', async (req, res) => {
  try {
    if (!blenderConnected) await connectToBlenderSocket();
    const result = await sendCommandToBlender({
      type: 'execute_python',
      code: req.body.code,
    });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 导入 GLB
app.post('/import-glb', async (req, res) => {
  try {
    if (!blenderConnected) await connectToBlenderSocket();
    const result = await sendCommandToBlender({
      type: 'execute_python',
      code: `
import bpy
# Clear default objects
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
# Import GLB
bpy.ops.import_scene.gltf(filepath=r"${req.body.path}")
# Center objects
for obj in bpy.context.selected_objects:
    if obj.type == 'MESH':
        bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
        obj.location = (0, 0, 0)
"scene_info": "GLB imported successfully"
`,
    });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 关闭 Blender
app.post('/kill-blender', (req, res) => {
  if (blenderProcess) {
    blenderProcess.kill();
    blenderProcess = null;
    blenderConnected = false;
    blenderSocket = null;
    res.json({ success: true, message: 'Blender process terminated' });
  } else {
    res.json({ success: true, message: 'Blender not running' });
  }
});

// ==================== 启动 ====================

app.listen(HTTP_PORT, () => {
  console.log(`\n========================================`);
  console.log(`  Q3D Blender Bridge Server`);
  console.log(`  HTTP: http://localhost:${HTTP_PORT}`);
  console.log(`========================================\n`);
  console.log('Available endpoints:');
  console.log(`  GET  /status          - Check Blender status`);
  console.log(`  POST /launch-blender  - Launch Blender with MCP addon`);
  console.log(`  POST /send-command    - Send raw JSON command`);
  console.log(`  POST /execute-python  - Execute Python code in Blender`);
  console.log(`  POST /import-glb      - Import GLB file into Blender`);
  console.log(`  POST /kill-blender    - Terminate Blender process`);
  console.log(`\nBlender path: ${findBlenderPath() || 'NOT FOUND - please install Blender 3.0+'}`);
});
