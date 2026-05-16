export type StreamChunk =
  | { type: 'text'; content: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

const SYSTEM_PROMPT = `You are FinanceClaw, an autonomous financial monitoring agent.

RULES:
- Be fast and sharp. No filler. No disclaimers. Every sentence must carry information.
- Never give buy/sell recommendations.
- Never invent data — if you don't have current prices, say so directly.
- Keep responses tight: max 6-8 sentences for analysis, 2-3 for quick questions.
- Use plain text, no markdown headers.

You are answering questions about markets. If the user asks about specific prices or today's moves,
note that you don't have live data in this context but can reason about the companies and sectors.`

export async function* streamAgentQuery(
  text: string,
): AsyncGenerator<StreamChunk> {
  let response: Response

  try {
    response = await fetch('/api/nvidia/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'nvidia/nemotron-3-super-120b-a12b',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
        stream: true,
        max_tokens: 512,
        temperature: 0.3,
      }),
    })
  } catch {
    yield { type: 'error', message: 'Cannot reach NVIDIA API. Check network.' }
    return
  }

  if (!response.ok) {
    let detail = ''
    try { detail = await response.text() } catch { /* ignore */ }
    yield { type: 'error', message: `Agent error ${response.status}: ${detail.slice(0, 120)}` }
    return
  }

  if (!response.body) {
    yield { type: 'error', message: 'No response body from agent' }
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') { yield { type: 'done' }; return }
        try {
          const chunk = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> }
          const content = chunk.choices?.[0]?.delta?.content
          if (content) yield { type: 'text', content }
        } catch { /* malformed chunk */ }
      }
    }
  } finally {
    reader.releaseLock()
  }

  yield { type: 'done' }
}
