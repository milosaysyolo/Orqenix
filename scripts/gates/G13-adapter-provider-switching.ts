// SPDX-License-Identifier: Apache-2.0
// @gate G13
import { GateRunner, type GateCheck, type GateReport } from '@orqenix/gate-runner-core';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { OllamaAdapter } from '@orqenix/llm-adapter-ollama';
import { OpenAiAdapter, AnthropicAdapter, GoogleAdapter, DeepSeekAdapter } from '@orqenix/llm-adapter-byok';

const REPO_ROOT = resolve(__dirname, '../..');
const REPORT_DIR = join(REPO_ROOT, '.orqenix/gate-reports');

const mockFetch = (fn: (url: string, init?: RequestInit) => Promise<Response>) => fn as unknown as typeof fetch;

class G13 extends GateRunner {
  readonly id = 'G13';
  readonly title = 'Adapter Provider Switching';
  protected loadSpec(): unknown {
    return readFileSync(join(REPO_ROOT, '.orqenix/charter-gates/G13.yaml'), 'utf-8');
  }
  protected async runChecks(): Promise<GateCheck[]> {
    return [
      await this.check('G13.1', 'each adapter reports correct provider label', async () => {
        const ollama = new OllamaAdapter({ fetchImpl: mockFetch(async () => new Response('{}', { status: 200 })) });
        if (ollama.provider !== 'ollama') throw new Error('ollama provider mismatch');
        const openai = new OpenAiAdapter({ apiKey: 'k', fetchImpl: mockFetch(async () => new Response('{}', { status: 200 })) });
        if (openai.provider !== 'openai') throw new Error('openai provider mismatch');
        const anthropic = new AnthropicAdapter({ apiKey: 'k', fetchImpl: mockFetch(async () => new Response('{}', { status: 200 })) });
        if (anthropic.provider !== 'anthropic') throw new Error('anthropic provider mismatch');
        const google = new GoogleAdapter({ apiKey: 'k', fetchImpl: mockFetch(async () => new Response('{}', { status: 200 })) });
        if (google.provider !== 'google') throw new Error('google provider mismatch');
        const ds = new DeepSeekAdapter({ apiKey: 'k', fetchImpl: mockFetch(async () => new Response('{}', { status: 200 })) });
        if (ds.provider !== 'deepseek') throw new Error('deepseek provider mismatch');
      }),

      await this.check('G13.2', 'each adapter uses CR v7.1 default model', () => {
        const cases: Array<{ adapter: { model: string }; expected: string }> = [
          { adapter: new OllamaAdapter(),                                               expected: 'qwen2.5:7b' },
          { adapter: new OpenAiAdapter({ apiKey: 'k' }),                                expected: 'gpt-4o-mini' },
          { adapter: new AnthropicAdapter({ apiKey: 'k' }),                             expected: 'claude-haiku-4' },
          { adapter: new GoogleAdapter({ apiKey: 'k' }),                                expected: 'gemini-flash-2.5' },
          { adapter: new DeepSeekAdapter({ apiKey: 'k' }),                              expected: 'deepseek-chat-v3' },
        ];
        for (const c of cases) {
          if (c.adapter.model !== c.expected) throw new Error(`default model wrong: ${c.adapter.model} != ${c.expected}`);
        }
      }),

      await this.check('G13.3', 'OpenAI rejects missing apiKey', () => {
        let caught = false;
        try { new OpenAiAdapter({ apiKey: '' } as any); } catch { caught = true; }
        if (!caught) throw new Error('OpenAi accepted empty apiKey');
        let caught2 = false;
        try { new AnthropicAdapter({ apiKey: '' } as any); } catch { caught2 = true; }
        if (!caught2) throw new Error('Anthropic accepted empty apiKey');
        let caught3 = false;
        try { new GoogleAdapter({ apiKey: '' } as any); } catch { caught3 = true; }
        if (!caught3) throw new Error('Google accepted empty apiKey');
      }),

      await this.check('G13.4', 'Ollama uses default baseUrl localhost:11434', async () => {
        let observedUrl = '';
        const a = new OllamaAdapter({
          fetchImpl: mockFetch(async (url) => {
            observedUrl = url;
            return new Response(JSON.stringify({ message: { content: 'ok' }, done_reason: 'stop' }), {
              status: 200, headers: { 'content-type': 'application/json' },
            });
          }),
        });
        await a.complete({ messages: [{ role: 'user', content: 'x' }] });
        if (!observedUrl.startsWith('http://localhost:11434')) throw new Error(`unexpected baseUrl: ${observedUrl}`);
      }),

      await this.check('G13.5', 'custom baseUrl overrides default (OpenAI-compatible endpoint)', async () => {
        let observedUrl = '';
        const a = new OpenAiAdapter({
          apiKey: 'k', baseUrl: 'https://api.together.xyz/v1',
          fetchImpl: mockFetch(async (url) => {
            observedUrl = url;
            return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] }), {
              status: 200, headers: { 'content-type': 'application/json' },
            });
          }),
        });
        await a.complete({ messages: [{ role: 'user', content: 'x' }] });
        if (!observedUrl.startsWith('https://api.together.xyz/v1')) throw new Error(`baseUrl override failed: ${observedUrl}`);
      }),
    ];
  }
  protected writeReport(report: GateReport): void {
    mkdirSync(REPORT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    writeFileSync(join(REPORT_DIR, `G13-${ts}.json`), JSON.stringify(report, null, 2));
  }
}

async function main(): Promise<void> {
  const r = new G13();
  const rep = await r.execute();
  r.printSummary(rep);
  process.exit(rep.status === 'pass' ? 0 : 1);
}
main().catch((e) => { console.error('G13 crashed:', e); process.exit(2); });
