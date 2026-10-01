/**
 * LLM provider adapter. The rest of the AI module talks to this interface:
 *
 *   chat({ system, messages, tools, maxTokens }) → {
 *     stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'refusal' | …,
 *     text, toolCalls: [{ id, name, input }], assistantContent, usage: { input, output }
 *   }
 *   toolResultsMessage([{ id, content, isError }]) → message to append
 *
 * Conversation messages use the Anthropic Messages format. A future provider
 * (e.g. an OpenAI-compatible API) would add a sibling class that translates
 * to/from this shape; nothing else needs to change.
 */
const Anthropic = require('@anthropic-ai/sdk');

class AnthropicProvider {
  constructor({ apiKey, model }) {
    this.model  = model;
    this.client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 2 });
  }

  async chat({ system, messages, tools, maxTokens = 2048 }) {
    const response = await this.client.messages.create({
      model:      this.model,
      max_tokens: maxTokens,
      system,
      tools,
      messages,
    });
    return {
      stopReason:       response.stop_reason,
      text:             response.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim(),
      toolCalls:        response.content.filter(b => b.type === 'tool_use').map(b => ({ id: b.id, name: b.name, input: b.input })),
      assistantContent: response.content,
      usage:            { input: response.usage.input_tokens || 0, output: response.usage.output_tokens || 0 },
    };
  }

  /** All tool results go back in ONE user message (keeps parallel tool use working). */
  toolResultsMessage(results) {
    return {
      role: 'user',
      content: results.map(r => ({ type: 'tool_result', tool_use_id: r.id, content: r.content, ...(r.isError && { is_error: true }) })),
    };
  }

  /** Map SDK errors to a status + message safe to show an admin. */
  describeError(err) {
    if (err instanceof Anthropic.AuthenticationError) return { status: 503, message: 'The AI API key is invalid. Check ANTHROPIC_API_KEY on the server.' };
    if (err instanceof Anthropic.PermissionDeniedError) return { status: 503, message: 'The AI API key does not have access to this model.' };
    if (err instanceof Anthropic.RateLimitError)     return { status: 429, message: 'The AI service is busy (rate limit). Please try again in a minute.' };
    if (err instanceof Anthropic.BadRequestError)    return { status: 502, message: 'The AI service rejected the request. If this keeps happening, check your Anthropic account credit.' };
    if (err instanceof Anthropic.APIConnectionError) return { status: 504, message: 'Could not reach the AI service. Please try again.' };
    if (err instanceof Anthropic.APIError)           return { status: 502, message: 'The AI service had a problem. Please try again.' };
    return null;
  }
}

module.exports = { AnthropicProvider };
