/**
 * Provider 架构冒烟测试
 * 验证各 Provider 能正确初始化和响应
 */
import { config, isApiConfigured, isTraeEnvironment, isTraeNativeAvailable } from '../dist/config.js';
import { resolveAvatarProvider, getCurrentProviderName, isTraeNativeActive, traeNativeProvider, externalApiProvider, mockAvatarProvider } from '../dist/providers/avatar-resolver.js';
import { TraeCollabSignal } from '../dist/providers/types.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS: ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL: ${name} — ${e.message}`);
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  PASS: ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL: ${name} — ${e.message}`);
  }
}

console.log('=== Q3D Provider Architecture Smoke Test ===\n');

// === Config 测试 ===
console.log('--- Config Layer ---');

test('config.aiProvider is string', () => {
  if (typeof config.aiProvider !== 'string') throw new Error(`Expected string, got ${typeof config.aiProvider}`);
});

test('config.traeVisionEnabled is boolean', () => {
  if (typeof config.traeVisionEnabled !== 'boolean') throw new Error('Expected boolean');
});

test('isTraeEnvironment returns boolean', () => {
  const result = isTraeEnvironment();
  if (typeof result !== 'boolean') throw new Error('Expected boolean');
});

test('isTraeNativeAvailable returns boolean', () => {
  const result = isTraeNativeAvailable();
  if (typeof result !== 'boolean') throw new Error('Expected boolean');
});

test('isApiConfigured returns boolean', () => {
  const result = isApiConfigured();
  if (typeof result !== 'boolean') throw new Error('Expected boolean');
});

// === Provider 实例测试 ===
console.log('\n--- Provider Instances ---');

test('traeNativeProvider has name', () => {
  if (!traeNativeProvider.name) throw new Error('Missing name');
});

test('externalApiProvider has name', () => {
  if (!externalApiProvider.name) throw new Error('Missing name');
});

test('mockAvatarProvider has name', () => {
  if (!mockAvatarProvider.name) throw new Error('Missing name');
});

test('mockAvatarProvider.isAvailable() returns true', () => {
  if (!mockAvatarProvider.isAvailable()) throw new Error('Expected true');
});

// === Provider 解析器测试 ===
console.log('\n--- Provider Resolver ---');

await testAsync('resolveAvatarProvider returns a provider with name', async () => {
  const p = await resolveAvatarProvider();
  if (!p || !p.name) throw new Error('Expected provider with name');
});

await testAsync('getCurrentProviderName returns string', async () => {
  const name = await getCurrentProviderName();
  if (typeof name !== 'string') throw new Error('Expected string');
});

await testAsync('isTraeNativeActive returns boolean', async () => {
  const result = await isTraeNativeActive();
  if (typeof result !== 'boolean') throw new Error('Expected boolean');
});

// === Mock Provider 功能测试 ===
console.log('\n--- Mock Provider Functions ---');

await testAsync('mockAvatarProvider.analyzePhoto returns structured data', async () => {
  const result = await mockAvatarProvider.analyzePhoto('fakebase64');
  const required = ['gender', 'ageRange', 'hairStyle', 'facialFeatures', 'clothing', 'expression', 'overallVibe'];
  for (const field of required) {
    if (!(field in result)) throw new Error(`Missing field: ${field}`);
  }
});

await testAsync('mockAvatarProvider.generateAvatar returns imageUrl + revisedPrompt', async () => {
  const result = await mockAvatarProvider.generateAvatar('test prompt', 'kawaii');
  if (!result.imageUrl) throw new Error('Missing imageUrl');
  if (!result.revisedPrompt) throw new Error('Missing revisedPrompt');
  if (!result.imageUrl.startsWith('mock://')) throw new Error(`Expected mock:// URL, got ${result.imageUrl}`);
});

await testAsync('mockAvatarProvider.chatCompletion returns string', async () => {
  const result = await mockAvatarProvider.chatCompletion([{ role: 'user', content: 'hi' }]);
  if (typeof result !== 'string') throw new Error('Expected string');
  if (result.length === 0) throw new Error('Empty response');
});

// === TraeCollabSignal 枚举测试 ===
console.log('\n--- TraeCollabSignal Enum ---');

test('TraeCollabSignal has all expected values', () => {
  const expected = ['NEED_VISION_ANALYSIS', 'NEED_IMAGE_GENERATION', 'NEED_CHAT_COMPLETION'];
  for (const val of expected) {
    if (!(val in TraeCollabSignal)) throw new Error(`Missing signal: ${val}`);
  }
});

// === Summary ===
console.log(`\n=== Results: ${passed} passed, ${failed} failed (${passed + failed} total) ===`);

if (failed > 0) process.exit(1);
console.log('\nAll smoke tests passed! ✓');
