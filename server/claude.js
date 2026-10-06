// Shared Claude client. Server-side refusal fallback is enabled by default ("default" routing).
import Anthropic from "@anthropic-ai/sdk";

export const AI_ENABLED = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
export const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";

const client = AI_ENABLED ? new Anthropic() : null;

/** One Messages API call with adaptive thinking, explicit effort, caching and refusal fallback. */
export function createMessage({ system, messages, tools, effort = "medium", maxTokens = 16000 }) {
  return client.beta.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort },
    cache_control: { type: "ephemeral" },
    system,
    tools,
    messages,
  });
}

export { Anthropic };
