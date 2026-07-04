# Blender MCP 操作指南

> 本文档供 IDE 中操作参考，避免误操作导致环境冲突。

---

## 一、架构概览

```
IDE (MCP Client)
    |
    | HTTP 8777
    v
Q3D Blender Bridge (Node.js)
    |
    | TCP 9877
    v
Blender + addon.py (MCP Server)
```

| 组件 | 文件路径 | 作用 |
|---|---|---|
| **Bridge** | `bridge/q3d-blender-bridge.js` | HTTP 桥接服务器，接收 IDE 请求并转发给 Blender |
| **Addon** | `third_party/blender-mcp/addon.py` | Blender 插件，启动 TCP Server 接收 Python 执行指令 |
| **Blender** | `E:\blender\blender.exe` | 3D 建模软件 |

---

## 二、端口配置（不要改！）

| 端口 | 用途 | 对应文件 |
|---|---|---|
| `8777` | Bridge HTTP 服务 | `bridge/q3d-blender-bridge.js` 第 17 行 |
| `9877` | Blender TCP 服务 | `third_party/blender-mcp/addon.py` 第 33 行 |

**两个端口必须保持一致，不要手动修改。**

---

## 三、启动流程

### 方式 A：命令行启动（推荐）

```powershell
cd "d:\Trae CN\Q3D_Dream_Machine\bridge"
node q3d-blender-bridge.js
```

Bridge 启动后会自动检测 Blender 路径（`E:\blender\blender.exe`）。

### 方式 B：API 启动 Blender

Bridge 运行后，调用：

```powershell
Invoke-RestMethod -Uri "http://localhost:8777/launch-blender" -Method Post
```

这会启动 Blender GUI 并自动加载 addon.py，addon 会自动在 9877 端口启动 TCP Server。

### 方式 C：IDE 中启动

在 IDE 中通过 MCP 工具调用 `q3d_execute_blender_script` 时，工具会先检查 Bridge 状态，如果 Bridge 未运行会提示启动。

---

## 四、关闭流程

### 正确关闭顺序

1. **先关 Blender**（释放 9877 端口）
   ```powershell
   Invoke-RestMethod -Uri "http://localhost:8777/kill-blender" -Method Post
   ```

2. **再关 Bridge**（释放 8777 端口）
   ```powershell
   Stop-Process -Name "node" -Force
   ```

### 一键清理所有进程

```powershell
Get-Process -Name "node","blender" -ErrorAction SilentlyContinue | Stop-Process -Force
```

---

## 五、健康检查

```powershell
# 检查 Bridge 状态
Invoke-RestMethod -Uri "http://localhost:8777/status" | ConvertTo-Json

# 检查端口占用
Get-NetTCPConnection -LocalPort 8777,9877 -ErrorAction SilentlyContinue
```

正常状态示例：
```json
{
  "status": "ok",
  "blenderConnected": true,
  "blenderPid": 69300,
  "blenderPath": "E:\\blender\\blender.exe"
}
```

---

## 六、常见陷阱（重要！）

### 陷阱 1：旧 Bridge 进程残留

**现象**：修改了 bridge.js 或 addon.py，但测试时行为没变；`status` 返回 `blenderConnected: false`。

**原因**：之前启动的 Bridge 进程还在后台运行并占用 8777 端口，新的请求发给了旧进程。

**解决**：
```powershell
Get-Process -Name "node" | Select-Object Id,Path
# 找到 q3d-blender-bridge.js 对应的 PID，杀掉它
Stop-Process -Id <PID> -Force
```

### 陷阱 2：端口被占用

**现象**：Bridge 启动报错 `EADDRINUSE`。

**解决**：找到占用端口的进程并杀掉：
```powershell
Get-NetTCPConnection -LocalPort 8777 | Select-Object OwningProcess
Stop-Process -Id <OwningProcess> -Force
```

### 陷阱 3：addon.py 路径错误

**现象**：Blender 启动了，但 9877 端口没监听。

**原因**：旧代码中 addon 路径指向了 `bridge/blender-mcp-addon.py`（旧文件），正确的路径是 `third_party/blender-mcp/addon.py`。

**当前代码已修复**，如果遇到此问题请确认 Bridge 运行的是最新代码。

### 陷阱 4：手动启动 Blender 和 Bridge 启动的区别

- **手动**：`blender --python addon.py` —— 直接在命令行执行
- **Bridge**：通过 `child_process.spawn()` 启动 —— Node.js 内部调用

两者效果相同，但 Bridge 启动会自动管理进程生命周期。

---

## 七、MCP 工具调用链

IDE 调用 `q3d_execute_blender_script` 时的内部流程：

1. 检查 Bridge 健康：`GET http://localhost:8777/status`
2. 如果 Blender 未启动，调用 `POST /launch-blender`
3. 读取 `.py` 脚本文件内容
4. 发送给 Bridge：`POST /execute-python`（body: `{ code: "..." }`）
5. Bridge 转发给 Blender addon 的 TCP Server（9877）
6. addon 在 Blender 中执行 Python 代码，返回结果

---

## 八、当前环境状态

- Blender 路径：`E:\blender\blender.exe`
- Bridge 端口：8777
- Addon 端口：9877
- **当前状态**：所有进程已清理，端口空闲，可以去 IDE 测试

---

## 九、快速排查清单

| 问题 | 排查命令 |
|---|---|
| Bridge 是否运行？ | `Get-Process -Name "node" \| Select-Object Id,Path` |
| Blender 是否运行？ | `Get-Process -Name "blender"` |
| 8777 是否被占用？ | `Get-NetTCPConnection -LocalPort 8777` |
| 9877 是否被占用？ | `Get-NetTCPConnection -LocalPort 9877` |
| Bridge 状态？ | `Invoke-RestMethod -Uri "http://localhost:8777/status"` |
| addon 日志？ | `Get-Content "third_party/blender-mcp/blender_mcp.log"` |
