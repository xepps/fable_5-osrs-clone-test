import { useState } from 'react'

type Props = Readonly<{ onSubmit: (name: string) => void }>

export const NamePrompt = ({ onSubmit }: Props) => {
  const [name, setName] = useState('')
  const trimmed = name.trim()
  const valid = trimmed.length >= 1 && trimmed.length <= 12
  return (
    <div className="name-prompt-backdrop">
      <form
        className="name-prompt panel"
        onSubmit={(event) => {
          event.preventDefault()
          if (valid) onSubmit(trimmed)
        }}
      >
        <h1>Choose a display name</h1>
        <input
          autoFocus
          aria-label="Display name"
          maxLength={12}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Adventurer"
        />
        <button type="submit" disabled={!valid}>
          Play
        </button>
      </form>
    </div>
  )
}
