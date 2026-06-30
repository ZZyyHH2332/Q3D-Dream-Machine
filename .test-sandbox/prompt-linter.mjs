#!/usr/bin/env node
/**
 * Q3D Prompt Linter
 * 静态校验 prompt 文本，零 API 调用成本
 * Usage: node prompt-linter.mjs [path/to/prompt-file]
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

// Load style prompts from dist (or src if not built)
const distApiPath = path.join(projectRoot, "mcp-server", "dist", "utils", "api.js");
const srcApiPath = path.join(projectRoot, "mcp-server", "src", "utils", "api.ts");

// Default style prompts (fallback)
const DEFAULT_STYLE_PROMPTS = {
  kawaii: "soft pastel colors, big sparkling eyes, kawaii anime chibi style, round face, adorable, pink and mint tones",
  guofeng: "Chinese traditional style, ink wash aesthetics, elegant muted colors, flowing hanfu or modern Chinese fashion, graceful",
  trendy: "trendy toy figure style, bold saturated colors, sharp outlines, blind box toy aesthetic, collectible figure look",
  simple: "minimalist cartoon style, clean lines, flat colors, geometric shapes, simple and cute, modern illustration",
};

// Known negative words that DALL-E 3 handles poorly
const NEGATIVE_WORDS = [
  "不要", "避免", "禁止", "不许", "不能", "不该",
  "dont", "don't", "avoid", "never", "no ", "not ",
  "without", "lack of", "minus",
];

// Unreplaced placeholder patterns
const PLACEHOLDER_PATTERNS = [
  /\[STYLE\]/i,
  /\{\{customPrompt\}\}/i,
  /\{\{style\}\}/i,
  /\{\{description\}\}/i,
];

// Invalid characters (beyond normal multilingual + punctuation)
// Whitelist includes: CJK chars, ASCII alnum, whitespace, common CN/EN punctuation
const INVALID_CHAR_PATTERN = /[^\u4e00-\u9fa5a-zA-Z0-9\s\u3000-\u303F\uFF00-\uFFEF\u2010-\u2027\u2030-\u205F\u00B7/|+=%&@#*~^_\-]/g;

// DALL-E 3 recommended max prompt length
const MAX_PROMPT_LENGTH = 1000;

function loadStylePrompts() {
  // Try to extract from source file
  const apiPath = fs.existsSync(srcApiPath) ? srcApiPath : distApiPath;
  if (!fs.existsSync(apiPath)) {
    console.error(`[Linter] Warning: api.ts/api.js not found, using default prompts`);
    return DEFAULT_STYLE_PROMPTS;
  }
  try {
    const content = fs.readFileSync(apiPath, "utf-8");
    // Extract STYLE_PROMPTS object using regex
    const match = content.match(/const\s+STYLE_PROMPTS\s*:\s*Record<string,\s*string>\s*=\s*\{([\s\S]*?)\};/);
    if (match) {
      const objText = match[0];
      // Simple extraction - find quoted keys and values
      const prompts = {};
      const keyValueRegex = /(\w+)\s*:\s*["']([^"']+)["']/g;
      let m;
      while ((m = keyValueRegex.exec(objText)) !== null) {
        prompts[m[1]] = m[2];
      }
      return Object.keys(prompts).length > 0 ? prompts : DEFAULT_STYLE_PROMPTS;
    }
  } catch (err) {
    console.error(`[Linter] Warning: Failed to parse STYLE_PROMPTS: ${err.message}`);
  }
  return DEFAULT_STYLE_PROMPTS;
}

function lintPrompt(promptText, source = "unknown") {
  const issues = [];

  // Check 1: Unreplaced placeholders
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(promptText)) {
      issues.push({
        severity: "error",
        rule: "placeholder-not-replaced",
        message: `Found unreplaced placeholder: ${pattern.source}`,
        source,
      });
    }
  }

  // Check 2: Negative words
  for (const word of NEGATIVE_WORDS) {
    if (promptText.toLowerCase().includes(word.toLowerCase())) {
      issues.push({
        severity: "warning",
        rule: "negative-instruction",
        message: `Negative instruction detected: "${word.trim()}". DALL-E 3 performs better with affirmative descriptions.`,
        source,
      });
    }
  }

  // Check 3: Length
  if (promptText.length > MAX_PROMPT_LENGTH) {
    issues.push({
      severity: "error",
      rule: "prompt-too-long",
      message: `Prompt length ${promptText.length} exceeds max ${MAX_PROMPT_LENGTH}`,
      source,
    });
  }

  // Check 4: Invalid characters
  const invalidChars = promptText.match(INVALID_CHAR_PATTERN);
  if (invalidChars && invalidChars.length > 10) {
    const unique = [...new Set(invalidChars)].slice(0, 5);
    issues.push({
      severity: "warning",
      rule: "invalid-characters",
      message: `Found ${invalidChars.length} potentially invalid characters (samples: ${JSON.stringify(unique)})`,
      source,
    });
  }

  // Check 5: Empty or too short
  if (promptText.trim().length < 20) {
    issues.push({
      severity: "error",
      rule: "prompt-too-short",
      message: `Prompt too short (${promptText.trim().length} chars)`,
      source,
    });
  }

  return issues;
}

function lintStylePrompts(stylePrompts) {
  const allIssues = [];
  for (const [style, prompt] of Object.entries(stylePrompts)) {
    const issues = lintPrompt(prompt, `STYLE_PROMPTS.${style}`);
    allIssues.push(...issues.map(i => ({ ...i, style })));
  }
  return allIssues;
}

function main() {
  console.log("========== Q3D Prompt Linter ==========");

  const stylePrompts = loadStylePrompts();
  console.log(`Loaded ${Object.keys(stylePrompts).length} style prompts`);

  // Lint style prompts
  const styleIssues = lintStylePrompts(stylePrompts);

  // Lint custom prompt file if provided
  let fileIssues = [];
  const inputFile = process.argv[2];
  if (inputFile && fs.existsSync(inputFile)) {
    const content = fs.readFileSync(inputFile, "utf-8");
    fileIssues = lintPrompt(content, inputFile);
  }

  const allIssues = [...styleIssues, ...fileIssues];

  // Report
  const errors = allIssues.filter(i => i.severity === "error");
  const warnings = allIssues.filter(i => i.severity === "warning");

  console.log(`\nResults: ${errors.length} errors, ${warnings.length} warnings`);

  if (errors.length > 0) {
    console.log("\n--- Errors ---");
    for (const e of errors) {
      console.log(`[${e.severity.toUpperCase()}] ${e.rule} (${e.source}${e.style ? ` / ${e.style}` : ""}): ${e.message}`);
    }
  }

  if (warnings.length > 0) {
    console.log("\n--- Warnings ---");
    for (const w of warnings) {
      console.log(`[${w.severity.toUpperCase()}] ${w.rule} (${w.source}${w.style ? ` / ${w.style}` : ""}): ${w.message}`);
    }
  }

  console.log("\n========== Lint Complete ==========");

  // Exit with error code if errors found
  process.exit(errors.length > 0 ? 1 : 0);
}

main();
