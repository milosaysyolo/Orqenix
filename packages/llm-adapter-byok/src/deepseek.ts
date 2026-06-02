// SPDX-License-Identifier: Apache-2.0
// @bc CS-009 DeepSeek Adapter (reuses OpenAI-compatible interface)
// @gate G8.5, G12

import { OpenAiAdapter, type OpenAiAdapterOptions } from './openai.js';

export type DeepSeekAdapterOptions = Omit<OpenAiAdapterOptions, 'baseUrl' | 'providerLabel'> & { baseUrl?: string };

export class DeepSeekAdapter extends OpenAiAdapter {
  constructor(opts: DeepSeekAdapterOptions) {
    super({
      ...opts,
      model: opts.model ?? 'deepseek-chat-v3',
      baseUrl: opts.baseUrl ?? 'https://api.deepseek.com/v1',
      providerLabel: 'deepseek',
    });
  }
}
