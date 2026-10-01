/**
 * Provider for any OpenAI-compatible chat API: Cerebras, Groq, Ollama,
 * OpenRouter, Gemini's OpenAI endpoint, …  (same interface as AnthropicProvider)
 *
 * Conversation messages stay in the neutral (Anthropic-style) format used by
 * assistant.js; this class translates on the way in and out, so a question
 * can even move between providers mid-answer when one hits its free limit.
 */

class ProviderError extends Error {
  constructor(message, { status = 0, retryable = true, provider } = {}) {
    super(message);
    this.status = status;
    this.retryable = retryable;
    this.provider = provider;
  }
}

/** Neutral messages → OpenAI chat messages */
const toOpenAIMessages = (system, messages) => {
  const out = [{ role: 'system', content: system.map(b => b.text).join('\n\n') }];
  for (const m of messages) {
    if (typeof m.content === 'string') { out.push({ role: m.role, content: m.content }); continue; }
    if (m.role === 'assistant') {
      const text  = m.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
      const calls = m.content.filter(b => b.type === 'tool_use');
      out.push({
        role: 'assistant',
        content: text || '',
        ...(calls.length && { tool_calls: calls.map(c => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.input ?? {}) } })) }),
      });
      continue;
    }
    for (const b of m.content) {                     // user turn: tool results and/or text
      if (b.type === 'tool_result') out.push({ role: 'tool', tool_call_id: b.tool_use_id, content: String(b.content) });
      else if (b.type === 'text')   out.push({ role: 'user', content: b.text });
    }
  }
  return out;
};

const FINISH = { stop: 'end_turn', tool_calls: 'tool_use', length: 'max_tokens', content_filter: 'refusal' };

class OpenAICompatibleProvider {
  /**
   * @param {object} o
   * @param {string} o.name      label for logs ('cerebras', 'groq', …)
   * @param {string} o.baseURL   e.g. https://api.cerebras.ai/v1
   * @param {string} [o.apiKey]
   * @param {string} o.model
   * @param {object} [o.extraBody]  provider/model specific params
   */
  constructor({ name, baseURL, apiKey, model, extraBody = {} }) {
    Object.assign(this, { name, baseURL: baseURL.replace(/\/+$/, ''), apiKey, model, extraBody });
  }

  async chat({ system, messages, tools, maxTokens = 4096 }) {
    let res;
    try {
      res = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }) },
        body: JSON.stringify({
          model: this.model,
          max_tokens: maxTokens,
          messages: toOpenAIMessages(system, messages),
          tools: tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } })),
          tool_choice: 'auto',
          ...this.extraBody,
        }),
        signal: AbortSignal.timeout(90_000),
      });
    } catch (err) {
      throw new ProviderError(`${this.name}: could not connect (${err.name === 'TimeoutError' ? 'timeout' : err.message})`, { provider: this.name });
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      // 401/403/404 = configuration problem (bad key / unknown model) — still try the next provider
      throw new ProviderError(`${this.name}: HTTP ${res.status} ${body.slice(0, 300)}`, { status: res.status, provider: this.name });
    }

    const json   = await res.json();
    const choice = json.choices?.[0];
    if (!choice) throw new ProviderError(`${this.name}: empty response`, { provider: this.name });

    const msg  = choice.message || {};
    const text = (msg.content || '').trim();
    const toolCalls = (msg.tool_calls || []).map((c, i) => {
      let input = {}, inputError = null;
      try { input = c.function?.arguments ? JSON.parse(c.function.arguments) : {}; }
      catch { inputError = 'The tool arguments were not valid JSON. Call the tool again with valid JSON arguments.'; }
      return { id: c.id || `call_${Date.now()}_${i}`, name: c.function?.name, input, inputError };
    });

    return {
      stopReason: toolCalls.length ? 'tool_use' : (FINISH[choice.finish_reason] || 'end_turn'),
      text,
      toolCalls,
      // stored in neutral format so any provider can continue the conversation
      assistantContent: [
        ...(text ? [{ type: 'text', text }] : []),
        ...toolCalls.map(c => ({ type: 'tool_use', id: c.id, name: c.name, input: c.input })),
      ],
      usage: { input: json.usage?.prompt_tokens || 0, output: json.usage?.completion_tokens || 0 },
      provider: this.name,
    };
  }

  toolResultsMessage(results) {
    return {
      role: 'user',
      content: results.map(r => ({ type: 'tool_result', tool_use_id: r.id, content: r.content, ...(r.isError && { is_error: true }) })),
    };
  }

  describeError(err) {
    if (!(err instanceof ProviderError)) return null;
    if (err.status === 429) return { status: 429, message: 'The free AI limit is used up for now. Please try again in a few minutes (or tomorrow).' };
    if (err.status === 401 || err.status === 403) return { status: 503, message: `The ${err.provider} API key is invalid. Check it in the server settings.` };
    return { status: 502, message: 'The AI service is not responding right now. Please try again shortly.' };
  }
}

/**
 * Tries providers in order. A provider that fails (rate limit, outage, bad key)
 * is skipped for a cool-down period so later questions don't wait on it.
 */
class FallbackProvider {
  constructor(providers, { cooldownMs = 60_000, logger } = {}) {
    this.providers = providers;
    this.cooldownMs = cooldownMs;
    this.logger = logger;
    this.until = new Map();          // provider name → timestamp it may be tried again
  }

  get names() { return this.providers.map(p => p.name); }

  async chat(req) {
    const now = Date.now();
    const ready = this.providers.filter(p => (this.until.get(p.name) || 0) <= now);
    const order = ready.length ? ready : this.providers;        // all cooling down → try anyway
    let lastErr;
    for (const p of order) {
      try {
        const out = await p.chat(req);
        this.until.delete(p.name);
        return { ...out, provider: out.provider || p.name };
      } catch (err) {
        lastErr = err;
        const cool = err.status === 429 ? this.cooldownMs : err.status === 401 || err.status === 403 ? 10 * 60_000 : 20_000;
        this.until.set(p.name, Date.now() + cool);
        this.logger?.warn?.(`AI provider ${p.name} failed, trying next: ${err.message}`);
      }
    }
    throw lastErr;
  }

  toolResultsMessage(results) { return this.providers[0].toolResultsMessage(results); }

  describeError(err) {
    for (const p of this.providers) { const d = p.describeError(err); if (d) return d; }
    return null;
  }
}

module.exports = { OpenAICompatibleProvider, FallbackProvider, ProviderError, toOpenAIMessages };
