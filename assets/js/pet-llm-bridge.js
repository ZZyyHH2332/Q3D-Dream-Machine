/**
 * Q3D Pet LLM Bridge — 统一 LLM 适配层
 * 支持：Ollama 本地 / OpenAI 兼容远程 API / 模拟降级
 * 流式输出（SSE / NDJSON）+ 动态人格化 Prompt
 */

const LLMBridge = (function() {
  'use strict';

  // ========== 配置 ==========
  const CFG = {
    ollamaBase: 'http://localhost:11434',
    ollamaTimeout: 3000,
    streamTimeout: 30000,
    maxRetries: 1,
  };

  let currentProvider = 'mock'; // 'ollama' | 'openai' | 'mock'
  let ollamaModel = null;

  // ========== Ollama 探测 ==========
  async function probeOllama() {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), CFG.ollamaTimeout);
      const res = await fetch(`${CFG.ollamaBase}/api/tags`, {
        method: 'GET',
        signal: ctrl.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timer);
      if (!res.ok) return null;
      const data = await res.json();
      const models = data.models || [];
      // 优先选择 qwen 系列或 llama 系列
      const preferred = models.find(m => /qwen/i.test(m.name))
        || models.find(m => /llama/i.test(m.name))
        || models[0];
      return preferred ? preferred.name : null;
    } catch (e) {
      return null;
    }
  }

  // ========== 动态人格化 Prompt ==========
  function buildSystemPrompt(ctx) {
    const mood = (typeof PET_MOODS !== 'undefined' && PET_MOODS[ctx.mood])
      ? PET_MOODS[ctx.mood]
      : { label: '开心', icon: '😊' };

    let prompt = `你是 Q3D 形象造梦机的桌面宠物，名字叫「${ctx.petName}」。
当前心情：${mood.icon} ${mood.label}
性格设定：${ctx.personality || '活泼可爱'}

回复要求：
- 简短活泼，每次不超过 60 字
- 带适当 emoji
- 语气要符合当前心情
- 如果用户夸你，表现出开心；如果冷落你，表现委屈
- 不要重复自我介绍`;

    // 如果有养成数据，注入 Prompt
    if (ctx.stats) {
      const level = Math.floor((ctx.stats.affection || 0) / 120) + 1;
      prompt += `\n好感度等级：${level}级（${ctx.stats.affection || 0}点）`;
      if (ctx.stats.satiety !== undefined) {
        prompt += `\n饱食度：${Math.round(ctx.stats.satiety)}%`;
      }
    }

    return prompt;
  }

  // ========== Ollama 流式对话 ==========
  async function* streamOllama(messages, model) {
    const res = await fetch(`${CFG.ollamaBase}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || ollamaModel,
        messages: messages,
        stream: true,
        options: { temperature: 0.8 }
      })
    });

    if (!res.ok) throw new Error(`Ollama error: ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (data.message?.content) yield { type: 'token', content: data.message.content };
          if (data.done) yield { type: 'done' };
        } catch (e) { /* ignore malformed line */ }
      }
    }
    if (buffer.trim()) {
      try {
        const data = JSON.parse(buffer);
        if (data.message?.content) yield { type: 'token', content: data.message.content };
      } catch (e) { }
    }
  }

  // ========== OpenAI 兼容流式对话 ==========
  async function* streamOpenAI(messages, apiBase, apiKey, model) {
    const res = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: messages,
        max_tokens: 150,
        temperature: 0.8,
        stream: true
      })
    });

    if (!res.ok) throw new Error(`API error: ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') { yield { type: 'done' }; continue; }
        try {
          const data = JSON.parse(jsonStr);
          const delta = data.choices?.[0]?.delta?.content;
          if (delta) yield { type: 'token', content: delta };
        } catch (e) { /* ignore */ }
      }
    }
  }

  // ========== 模拟降级回复 ==========
  function* streamMock(userText, petName) {
    const text = userText.toLowerCase();
    const replies = [
      { keywords: ['你好', 'hi', 'hello'], reply: `你好呀！我是你的专属宠物 ${petName}~ 🎉` },
      { keywords: ['名字', '叫'], reply: `我叫 ${petName}，是你的 Q 版形象宠物哦~ 🐱` },
      { keywords: ['做什么', '功能'], reply: '我可以陪你聊天，还能帮你介绍 Q3D 的功能呢~ 🎨' },
      { keywords: ['可爱', '好看', '漂亮'], reply: '谢谢夸奖！你也很可爱呢~ 💕' },
      { keywords: ['joke', '笑话'], reply: '为什么程序员总是分不清圣诞节和万圣节？因为 Oct 31 == Dec 25！😄' },
      { keywords: ['bye', '再见', '拜拜'], reply: '再见啦！记得常来找我玩哦~ 👋' },
      { keywords: ['饿', '吃', '饭'], reply: '我也饿了~ 给我点虚拟零食吧！🍪' },
      { keywords: ['累', '困', '睡'], reply: '累了就休息一下吧，我陪你~ 😴' },
    ];

    let reply = '哇，这个话题好有趣！可以多跟我说说吗~ ✨';
    for (const r of replies) {
      if (r.keywords.some(k => text.includes(k))) { reply = r.reply; break; }
    }

    // 模拟逐字输出
    const chars = reply.split('');
    for (const ch of chars) {
      yield { type: 'token', content: ch };
    }
    yield { type: 'done' };
  }

  // ========== 统一流式接口 ==========
  async function* chat(userText, ctx) {
    const sysPrompt = buildSystemPrompt(ctx);
    const msgs = [{ role: 'system', content: sysPrompt }];

    // 注入历史对话
    if (ctx.history && ctx.history.length > 0) {
      for (const h of ctx.history.slice(-10)) {
        msgs.push({ role: h.role, content: h.content });
      }
    }
    msgs.push({ role: 'user', content: userText });

    // 探测优先级：Ollama > OpenAI > Mock
    if (currentProvider === 'mock') {
      // 尝试自动升级
      const ollamaModelName = await probeOllama();
      if (ollamaModelName) {
        ollamaModel = ollamaModelName;
        currentProvider = 'ollama';
      } else if (ctx.apiKey) {
        currentProvider = 'openai';
      }
    }

    try {
      if (currentProvider === 'ollama' && ollamaModel) {
        yield* streamOllama(msgs, ollamaModel);
      } else if (currentProvider === 'openai' && ctx.apiKey) {
        yield* streamOpenAI(msgs, ctx.apiBase, ctx.apiKey, ctx.model);
      } else {
        yield* streamMock(userText, ctx.petName);
      }
    } catch (e) {
      console.error('[LLMBridge] Error:', e);
      // 降级到 mock
      currentProvider = 'mock';
      yield* streamMock(userText, ctx.petName);
    }
  }

  // ========== 设置 API 配置 ==========
  function setConfig(config) {
    if (config.provider) currentProvider = config.provider;
    if (config.ollamaModel) ollamaModel = config.ollamaModel;
  }

  function getProvider() {
    return currentProvider;
  }

  // ========== 导出 ==========
  return {
    chat,
    probeOllama,
    setConfig,
    getProvider,
    buildSystemPrompt,
  };
})();

// 兼容 CommonJS / ES Module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LLMBridge };
}
