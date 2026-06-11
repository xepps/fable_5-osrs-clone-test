import { describe, expect, it } from 'vitest'
import { uniqueName } from './names'

describe('display name uniqueness', () => {
  it('keeps the requested name when nobody else has it', () => {
    expect(uniqueName('Bob', [])).toBe('Bob')
  })

  it('suffixes a counter when the name is taken, ignoring case', () => {
    expect(uniqueName('Bob', ['bob'])).toBe('Bob(2)')
    expect(uniqueName('Bob', ['Bob', 'Bob(2)'])).toBe('Bob(3)')
  })
})
