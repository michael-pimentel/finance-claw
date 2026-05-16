export type StreamChunk =
  | { type: 'text'; content: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

/**
 * Sends queries to the OpenClaw agent via the gateway's chat completions endpoint
 * and yields streamed response chunks.
 */
export async function* streamAgentQuery(
  text: string,
  sessionKey = 'dashboard-user'
): AsyncGenerator<StreamChunk> {
  let response: Response

  try {
    response = await fetch('/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openclaw',
        messages: [{ role: 'user', content: text }],
        stream: true,
        user: sessionKey,
      }),
    })
  } catch {
    yield { type: 'error', message: 'Cannot reach OpenClaw gateway. Is it running on port 18789?' }
    return
  }

  if (!response.ok) {
    let detail = ''
    try { detail = await response.text() } catch { /* ignore */ }
    yield { type: 'error', message: `Agent responded ${response.status}: ${detail.slice(0, 120)}` }
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
        if (data === '[DONE]') {
          yield { type: 'done' }
          return
        }

        try {
          const chunk = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>
          }
          const content = chunk.choices?.[0]?.delta?.content
          if (content) yield { type: 'text', content }
        } catch {
          // malformed SSE chunk — skip
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  yield { type: 'done' }
}
