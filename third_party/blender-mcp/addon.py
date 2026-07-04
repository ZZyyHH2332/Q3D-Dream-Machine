"""
Blender MCP Server
为 Q3D 项目提供 Blender Python API 的远程调用能力

启动方式：
blender --python addon.py
"""

import bpy
import json
import threading
import socket
import traceback
import sys
import os
from io import StringIO

# 日志文件
LOG_FILE = os.path.join(os.path.dirname(__file__), 'blender_mcp.log')

def log(msg):
    """写入日志文件"""
    try:
        with open(LOG_FILE, 'a', encoding='utf-8') as f:
            f.write(f"[BlenderMCP] {msg}\n")
    except:
        pass
    print(f"[BlenderMCP] {msg}")

# ==================== TCP Server ====================

HOST = 'localhost'
PORT = 9877  # 改用 9877 避免与其他 addon 冲突
server_running = False
server_thread = None


class BlenderMCPServer(threading.Thread):
    """Blender MCP TCP Server"""
    
    def __init__(self):
        super().__init__(daemon=True)
        self.running = False
        self.sock = None
    
    def run(self):
        global server_running
        self.running = True
        server_running = True
        
        try:
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.sock.bind((HOST, PORT))
            self.sock.listen(1)
            self.sock.settimeout(1.0)
            
            log(f"Server listening on {HOST}:{PORT}")
            
            while self.running:
                try:
                    conn, addr = self.sock.accept()
                    log(f"Connection from {addr}")
                    self.handle_connection(conn)
                except socket.timeout:
                    continue
                except Exception as e:
                    if self.running:
                        log(f"Accept error: {e}")
                    
        except Exception as e:
            log(f"Server error: {e}")
        finally:
            server_running = False
            log("Server stopped")
    
    def handle_connection(self, conn):
        """处理单个连接"""
        try:
            conn.settimeout(30)
            
            # 读取数据（直到收到完整JSON）
            data = b""
            while True:
                chunk = conn.recv(4096)
                if not chunk:
                    break
                data += chunk
                # 尝试解析JSON
                try:
                    text = data.decode('utf-8').strip()
                    if text:
                        command = json.loads(text)
                        break
                except (json.JSONDecodeError, UnicodeDecodeError):
                    continue
            
            if not data:
                return
            
            # 解析命令
            try:
                text = data.decode('utf-8').strip()
                command = json.loads(text)
            except json.JSONDecodeError:
                response = {"success": False, "error": "Invalid JSON"}
                conn.sendall((json.dumps(response) + '\n').encode('utf-8'))
                return
            
            # 执行命令
            result = self.execute_command(command)
            
            # 发送响应
            response = json.dumps(result) + '\n'
            conn.sendall(response.encode('utf-8'))
            
        except Exception as e:
            log(f"Connection error: {e}")
            try:
                error_response = json.dumps({"success": False, "error": str(e)}) + '\n'
                conn.sendall(error_response.encode('utf-8'))
            except:
                pass
        finally:
            conn.close()
    
    def execute_command(self, command):
        """执行命令"""
        cmd_type = command.get('type', '')
        
        if cmd_type == 'execute_python':
            return self.execute_python(command.get('code', ''))
        elif cmd_type == 'get_scene_info':
            return self.get_scene_info()
        elif cmd_type == 'ping':
            return {"success": True, "message": "pong"}
        else:
            return {"success": False, "error": f"Unknown command type: {cmd_type}"}
    
    def execute_python(self, code):
        """在 Blender 中执行 Python 代码"""
        try:
            # 捕获输出
            old_stdout = sys.stdout
            old_stderr = sys.stderr
            sys.stdout = StringIO()
            sys.stderr = StringIO()
            
            # 执行代码
            namespace = {"bpy": bpy}
            exec(code, namespace)
            
            # 获取输出
            stdout = sys.stdout.getvalue()
            stderr = sys.stderr.getvalue()
            
            # 恢复输出
            sys.stdout = old_stdout
            sys.stderr = old_stderr
            
            return {
                "success": True,
                "stdout": stdout,
                "stderr": stderr,
            }
            
        except Exception as e:
            # 恢复输出
            sys.stdout = old_stdout
            sys.stderr = old_stderr
            
            return {
                "success": False,
                "error": str(e),
                "traceback": traceback.format_exc(),
            }
    
    def get_scene_info(self):
        """获取场景信息"""
        try:
            objects = []
            for obj in bpy.context.scene.objects:
                objects.append({
                    "name": obj.name,
                    "type": obj.type,
                    "location": list(obj.location),
                })
            
            return {
                "success": True,
                "scene_name": bpy.context.scene.name,
                "object_count": len(bpy.context.scene.objects),
                "objects": objects,
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
            }
    
    def stop(self):
        """停止服务器"""
        self.running = False
        if self.sock:
            try:
                self.sock.close()
            except:
                pass


# ==================== 启动 Server ====================

def start_server():
    """启动 MCP Server"""
    global server_thread, server_running
    
    if server_running:
        log("Server already running")
        return
    
    server_thread = BlenderMCPServer()
    server_thread.start()
    log(f"Server started on port {PORT}")


# 当脚本被加载时自动启动
def try_start_server():
    """尝试启动 server，捕获所有异常"""
    try:
        log("Script loaded, starting server...")
        log(f"Python version: {sys.version}")
        log(f"Blender version: {bpy.app.version_string}")
        log(f"Working directory: {os.getcwd()}")
        log(f"Script directory: {os.path.dirname(__file__)}")
        start_server()
    except Exception as e:
        log(f"FATAL: Failed to start server: {e}")
        log(traceback.format_exc())

try_start_server()
