type Props = Readonly<{
  runEnergy: number
  runEnabled: boolean
  onToggle: () => void
}>

export const RunOrb = ({ runEnergy, runEnabled, onToggle }: Props) => (
  <button
    type="button"
    className={`run-orb${runEnabled ? ' run-orb-active' : ''}`}
    aria-pressed={runEnabled}
    aria-label="Toggle run"
    onClick={onToggle}
  >
    <span className="run-orb-icon" aria-hidden>
      🏃
    </span>
    <span className="run-orb-energy">{runEnergy}</span>
  </button>
)
