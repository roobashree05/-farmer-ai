import { AppException } from '../../common/app.exception';
import { describeAnthropicConfigFailure, parseAnthropicConfig, type EnvSource } from './anthropic-config';
import { AnthropicAIProvider } from './anthropic-ai.provider';
import type { AIProvider } from './ai.provider';
import { MockAIProvider } from './mock-ai.provider';

export function createAiProvider(env: EnvSource, http?: typeof fetch): AIProvider {
  const selected = (env.get('AI_PROVIDER') ?? 'mock').trim() || 'mock';
  if (selected === 'mock' || selected === 'local') return new MockAIProvider();
  if (selected === 'anthropic') {
    const parsed = parseAnthropicConfig(env);
    if (!parsed.ok) {
      throw new AppException('PROVIDER_NOT_CONFIGURED', describeAnthropicConfigFailure(parsed), 500);
    }
    return new AnthropicAIProvider(parsed.config, http);
  }
  throw new AppException(
    'PROVIDER_NOT_CONFIGURED',
    `AI provider "${selected}" is not available. Use mock or anthropic.`,
    500,
  );
}
