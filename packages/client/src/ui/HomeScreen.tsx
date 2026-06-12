import { useState } from 'react'
import type { CharacterSummary } from '../game/characters'

type Props = Readonly<{
  characters: readonly CharacterSummary[]
  error: string | null
  onSelect: (characterId: string) => void
  onCreate: (name: string) => void
}>

export const HomeScreen = ({ characters, error, onSelect, onCreate }: Props) => {
  const [name, setName] = useState('')
  const trimmed = name.trim()
  const valid = trimmed.length >= 1 && trimmed.length <= 12
  return (
    <div className="name-prompt-backdrop">
      <div className="home-screen panel">
        <h1>Welcome back, adventurer</h1>
        {error ? (
          <p role="alert" className="login-error">
            {error}
          </p>
        ) : null}
        {characters.length > 0 ? (
          <ul className="character-list">
            {characters.map((character) => (
              <li key={character.id}>
                <button
                  type="button"
                  className="character-row"
                  aria-label={`Play ${character.name}`}
                  onClick={() => onSelect(character.id)}
                >
                  <span className="character-name">{character.name}</span>
                  <span className="character-play">Play</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <form
          className="character-create"
          onSubmit={(event) => {
            event.preventDefault()
            if (valid) onCreate(trimmed)
          }}
        >
          <h2>{characters.length > 0 ? 'Or create a new character' : 'Create a character'}</h2>
          <input
            autoFocus
            aria-label="Display name"
            maxLength={12}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Adventurer"
          />
          <button type="submit" disabled={!valid}>
            Create
          </button>
        </form>
      </div>
    </div>
  )
}
