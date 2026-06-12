import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page, userEvent } from '@vitest/browser/context'
import { HomeScreen } from './HomeScreen'

const characters = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Zezima', lastPlayedAt: 2000 },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Bob', lastPlayedAt: 1000 },
]

describe('HomeScreen', () => {
  it('shows only the create form when there are no characters', async () => {
    render(<HomeScreen characters={[]} error={null} onSelect={() => {}} onCreate={() => {}} />)
    await expect.element(page.getByLabelText('Display name')).toBeVisible()
    expect(page.getByRole('button', { name: /^Play / }).elements()).toHaveLength(0)
  })

  it('creates a character with a trimmed display name', async () => {
    const onCreate = vi.fn()
    render(<HomeScreen characters={[]} error={null} onSelect={() => {}} onCreate={onCreate} />)
    await userEvent.fill(page.getByLabelText('Display name'), '  Zezima ')
    await page.getByRole('button', { name: 'Create' }).click()
    expect(onCreate).toHaveBeenCalledWith('Zezima')
  })

  it('refuses to create a character without a name', async () => {
    const onCreate = vi.fn()
    render(<HomeScreen characters={[]} error={null} onSelect={() => {}} onCreate={onCreate} />)
    await expect.element(page.getByRole('button', { name: 'Create' })).toBeDisabled()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('lists saved characters and selects one on click', async () => {
    const onSelect = vi.fn()
    render(
      <HomeScreen characters={characters} error={null} onSelect={onSelect} onCreate={() => {}} />,
    )
    await expect.element(page.getByText('Zezima')).toBeVisible()
    await page.getByRole('button', { name: 'Play Bob' }).click()
    expect(onSelect).toHaveBeenCalledWith('22222222-2222-4222-8222-222222222222')
  })

  it('shows a login error as an alert', async () => {
    render(
      <HomeScreen
        characters={characters}
        error="Your save data could not be read."
        onSelect={() => {}}
        onCreate={() => {}}
      />,
    )
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('Your save data could not be read.')
  })
})
