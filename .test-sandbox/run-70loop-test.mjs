#!/usr/bin/env node
/**
 * Q3D 70 Loop Multi-Agent Cluster Test Controller
 * Usage: node run-70loop-test.mjs
 */

import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nodePath = process.execPath;
const runnerPath = path.join(__dirname, "test-runner-v2.mjs");
const reportDir = path.join(__dirname, "reports");

// Ensure reports dir exists
fs.mkdirSync(reportDir, { recursive: true });

const agents = [
  { id: "A", start: 1, end: 40, desc: "效果测试" },
  { id: "B", start: 41, end: 60, desc: "全流程测试" },
  { id: "C", start: 61, end: 70, desc: "全功能测试" },
  { id: "X", start: 71, end: 80, desc: "10图随机批量测试" },
];

async function runAgent(agent) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      nodePath,
      [runnerPath, agent.id, agent.start, agent.end],
      {
        cwd: __dirname,
        env: { ...process.env, Q3D_TEST_MODE: "mock" },
      }
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      const line = data.toString().trim();
      stderr += line + "\n";
      // Print progress lines in real-time
      if (line.includes("[Loop") || line.includes("[TestRunner]")) {
        console.error(`[Agent ${agent.id}] ${line}`);
      }
    });

    child.on("close", (code) => {
      resolve({
        agentId: agent.id,
        exitCode: code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });

    child.on("error", reject);
  });
}

console.log("========== Q3D 80 Loop 多Agent集群测试启动 ==========");
console.log(`Agent A: Loop 1-40  (效果测试)`);
console.log(`Agent B: Loop 41-60 (全流程测试)`);
console.log(`Agent C: Loop 61-70 (全功能测试)`);
console.log(`Agent X: Loop 71-80 (10图随机批量测试)`);
console.log("=====================================================\n");

// Run all agents in parallel
const startTime = Date.now();
const agentResults = await Promise.all(agents.map(runAgent));
const totalDuration = Date.now() - startTime;

// Collect reports
const reports = agents
  .map((agent) => {
    const reportPath = path.join(reportDir, `agent-${agent.id}-report.json`);
    if (!fs.existsSync(reportPath)) return null;
    try {
      return JSON.parse(fs.readFileSync(reportPath, "utf-8"));
    } catch {
      return null;
    }
  })
  .filter(Boolean);

// Build summary
const totalLoops = agents.reduce((s, a) => s + (a.end - a.start + 1), 0);
const summary = {
  timestamp: new Date().toISOString(),
  totalLoops,
  totalPass: reports.reduce((s, r) => s + (r.passCount || 0), 0),
  totalFail: reports.reduce((s, r) => s + (r.failCount || 0), 0),
  totalDurationMs: totalDuration,
  agents: reports.map((r) => ({
    agentId: r.agentId,
    pass: r.passCount || 0,
    fail: r.failCount || 0,
    durationMs: r.totalDurationMs || 0,
    loops: (r.loopResults || []).map((l) => ({
      loopId: l.loopId,
      result: l.overallResult,
      scenario: l.scenario,
    })),
  })),
  failures: reports.flatMap((r) =>
    (r.loopResults || [])
      .filter((l) => l.overallResult === "FAIL")
      .map((l) => ({
        agentId: r.agentId,
        loopId: l.loopId,
        scenario: l.scenario,
        error:
          l.error ||
          l.stepResults?.find((s) => !s.success)?.errorCode ||
          "UNKNOWN",
      }))
  ),
};

// Write final report
const finalReportPath = path.join(reportDir, "final-70loop-summary.json");
fs.writeFileSync(
  finalReportPath,
  JSON.stringify(summary, null, 2),
  "utf-8"
);

// Print concise summary
const passRate =
  summary.totalLoops > 0
    ? ((summary.totalPass / summary.totalLoops) * 100).toFixed(1)
    : "0.0";

console.log("\n========== Q3D 70 Loop 多Agent集群测试汇总 ==========");
console.log(
  `总Loop: ${summary.totalLoops} | 通过: ${summary.totalPass} | 失败: ${summary.totalFail} | 通过率: ${passRate}%`
);
console.log(`总耗时: ${totalDuration}ms`);
console.log("--------------------------------------------------");
for (const a of summary.agents) {
  const agentDur = a.durationMs || 0;
  console.log(
    `Agent ${a.agentId}: PASS ${a.pass} / FAIL ${a.fail} | ${agentDur}ms`
  );
}

if (summary.failures.length > 0) {
  console.log("\n失败详情:");
  for (const f of summary.failures) {
    console.log(
      `  [Agent ${f.agentId} Loop ${f.loopId}] ${f.scenario}: ${f.error}`
    );
  }
} else {
  console.log("\n全部通过！");
}

console.log(`\n详细报告: ${finalReportPath}`);
console.log(
  `Agent A 报告: ${path.join(reportDir, "agent-A-report.json")}`
);
console.log(
  `Agent B 报告: ${path.join(reportDir, "agent-B-report.json")}`
);
console.log(
  `Agent C 报告: ${path.join(reportDir, "agent-C-report.json")}`
);
