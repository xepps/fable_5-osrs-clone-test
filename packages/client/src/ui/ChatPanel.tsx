import { useEffect, useRef, useState } from 'react'
import type { ChatLine } from '../store/reducer'

type Props = Readonly<{
  lines: readonly ChatLine[]
  onSend: (text: string) => void
}>

export const ChatPanel = ({ lines, onSend }: Props) => {
  const [draft, setDraft] = useState('')
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const log = logRef.current
    if (log) log.scrollTop = log.scrollHeight
  }, [lines])

  const submit = () => {
    const text = draft.trim()
    if (text.length === 0) return
    onSend(text)
    setDraft('')
  }

  return (
    <div className="chat-panel panel">
      <div className="chat-log" ref={logRef} aria-label="Chat log">
        {lines.map((line, index) => (
          <div key={index} className={line.kind === 'chat' ? 'chat-line' : 'system-line'}>
            {line.text}
          </div>
        ))}
      </div>
      <input
        className="chat-input"
        aria-label="Chat message"
        placeholder="Press enter to chat..."
        maxLength={80}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit()
        }}
      />
    </div>
  )
}
