export function registerHealthCheck(server: any): void {
  server.registerTool(
    "q3d_health_check",
    "Q3D 服务健康检查，验证 MCP Server 运行状态",
    {},
    async () => {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "ok",
                service: "q3d-mcp-server",
                version: "1.0.0",
                timestamp: new Date().toISOString(),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
