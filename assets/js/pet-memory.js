/**
 * Q3D Pet Memory — 对话历史管理 + 摘要压缩
 * 纯前端 localStorage 实现
 */

const PetMemory = (function() {
  'use strict';

  const STORAGE_KEY = 'q3d_pet_chat_history';
  const MAX_ROUNDS = 20;
  const MAX_CHARS = 4000; // 粗略字符上限

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data;
    } catch (e) {
      return [];
    }
  }

  function save(history) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
      // localStorage 满时自动压缩
      compressAndSave(history);
    }
  }

  // 估算 token 数（粗略：1 token ≈ 1.5 中文字符 或 0.75 英文字符）
  function estimateTokens(text) {
    const cn = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const en = text.length - cn;
    return Math.ceil(cn / 1.5 + en / 0.75);
  }

  function totalTokens(history) {
    return history.reduce((sum, h) => sum + estimateTokens(h.content || ''), 0);
  }

  // 摘要压缩：保留最近 N 轮，旧对话压缩为摘要
  function compressAndSave(history) {
    if (history.length <= 6) {
      // 太少不压缩，直接截断最旧的
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-6)));
      return;
    }

    // 保留最近 6 轮完整对话
    const recent = history.slice(-6);
    const old = history.slice(0, -6);

    // 旧对话生成摘要
    const summary = `【历史摘要】用户和${old.filter(h => h.role === 'user').length}次对话，宠物回复了${old.filter(h => h.role === 'assistant').length}次。`;

    const compressed = [
      { role: 'system', content: summary, isSummary: true },
      ...recent
    ];

    localStorage.setItem(STORAGE_KEY, JSON.stringify(compressed));
  }

  // 添加一条消息
  function add(role, content) {
    const history = load();
    history.push({
      role,
      content,
      timestamp: Date.now()
    });

    // 超限检查
    if (history.length > MAX_ROUNDS || totalTokens(history) > MAX_CHARS) {
      compressAndSave(history);
    } else {
      save(history);
    }
  }

  // 获取最近 N 轮（用于 LLM context）
  function getRecent(n = 10) {
    const history = load();
    return history.slice(-n).map(h => ({
      role: h.role,
      content: h.content
    }));
  }

  // 清空历史
  function clear() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // 导出为 JSON 文件
  function exportToFile() {
    const history = load();
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `q3d_pet_chat_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return {
    load,
    save,
    add,
    getRecent,
    clear,
    exportToFile,
    estimateTokens,
    totalTokens,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PetMemory };
}
