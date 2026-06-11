import type { MenuOption } from '../game/actions'
import type { ContextMenuState } from '../store/reducer'

type Props = Readonly<{
  menu: ContextMenuState
  onSelect: (option: MenuOption) => void
}>

export const ContextMenu = ({ menu, onSelect }: Props) => (
  <div
    className="context-menu"
    role="menu"
    style={{ left: menu.screenX, top: menu.screenY }}
    onContextMenu={(event) => event.preventDefault()}
  >
    <div className="context-menu-title">Choose Option</div>
    {menu.options.map((option, index) => (
      <button
        key={`${option.label}-${option.targetName ?? ''}-${index}`}
        role="menuitem"
        className="context-menu-option"
        onClick={() => onSelect(option)}
      >
        <span className="option-action">{option.label}</span>
        {option.targetName ? <span className="option-target"> {option.targetName}</span> : null}
      </button>
    ))}
  </div>
)
