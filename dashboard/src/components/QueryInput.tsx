import { useState, useRef, type KeyboardEvent } from 'react'

interface Props {
  onQuery: (text: string) => void
  isQuerying: boolean
}

const SUGGESTIONS = [
  'Why is NVDA moving today?',
  'How is TSLA doing this week?',
  'Compare MSFT vs GOOGL today',
  'Any earnings catalysts coming up?',
  'What sectors are leading right now?',
]

export default function QueryInput({ onQuery, isQuerying }: Props) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const submit = () => {
    const q = text.trim()
    if (!q || isQuerying) return
    onQuery(q)
    setText('')
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const useSuggestion = (s: string) => {
    if (isQuerying) return
    setText(s)
    inputRef.current?.focus()
  }

  return (
    <div>
      <div className="query-suggestions">
        {SUGGESTIONS.map(s => (
          <button key={s} className="suggestion-chip" onClick={() => useSuggestion(s)} disabled={isQuerying}>
            {s}
          </button>
        ))}
      </div>
      <div className="query-bar">
        <span className="query-prompt">›</span>
        <input
          ref={inputRef}
          className="query-input"
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder="Ask the agent anything about the market…"
          disabled={isQuerying}
          autoComplete="off"
          spellCheck={false}
        />
        {isQuerying ? (
          <span className="query-thinking">thinking…</span>
        ) : (
          <button className="query-send" onClick={submit} disabled={!text.trim()}>
            SEND ↵
          </button>
        )}
      </div>
    </div>
  )
}
