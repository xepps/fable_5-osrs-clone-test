import { useState } from 'react'
import {
  ITEMS,
  levelForXp,
  SKILLS,
  type EquipSlot,
  type ItemStack,
  type PrivateState,
} from '@osrs/shared'
import { inventoryMenuOptions, type GameAction, type MenuOption } from '../game/actions'

type Props = Readonly<{
  you: PrivateState
  onAction: (action: GameAction) => void
  onOpenMenu: (screenX: number, screenY: number, options: readonly MenuOption[]) => void
}>

type Tab = 'inventory' | 'equipment' | 'skills'

const SKILL_LABELS: Record<(typeof SKILLS)[number], string> = {
  attack: 'Attack',
  strength: 'Strength',
  defence: 'Defence',
  hitpoints: 'Hitpoints',
  woodcutting: 'Woodcutting',
  fishing: 'Fishing',
  cooking: 'Cooking',
}

const ItemIcon = ({ stack }: { stack: ItemStack }) => (
  <span className={`item-icon item-${stack.itemId}`} title={ITEMS[stack.itemId].name}>
    <span className="item-glyph" />
    {stack.quantity > 1 ? <span className="item-quantity">{stack.quantity}</span> : null}
  </span>
)

const InventoryGrid = ({ you, onAction, onOpenMenu }: Props) => (
  <div className="inventory-grid" aria-label="Inventory">
    {you.inventory.map((stack, slot) => (
      <button
        key={slot}
        className="inventory-slot"
        aria-label={
          stack ? `${ITEMS[stack.itemId].name} x${stack.quantity}` : `Empty slot ${slot + 1}`
        }
        onClick={() => {
          if (stack) onAction(inventoryMenuOptions(stack, slot)[0]!.action)
        }}
        onContextMenu={(event) => {
          event.preventDefault()
          if (stack) onOpenMenu(event.clientX, event.clientY, inventoryMenuOptions(stack, slot))
        }}
      >
        {stack ? <ItemIcon stack={stack} /> : null}
      </button>
    ))}
  </div>
)

const EquipmentPanel = ({ you, onAction }: Pick<Props, 'you' | 'onAction'>) => {
  const slots: ReadonlyArray<{ slot: EquipSlot; label: string }> = [
    { slot: 'head', label: 'Head' },
    { slot: 'weapon', label: 'Weapon' },
  ]
  return (
    <div className="equipment-panel">
      {slots.map(({ slot, label }) => {
        const stack = you.equipment[slot]
        return (
          <button
            key={slot}
            className="equipment-slot"
            aria-label={stack ? `Unequip ${ITEMS[stack.itemId].name}` : `${label} slot (empty)`}
            onClick={() => {
              if (stack)
                onAction({ type: 'send', message: { type: 'unequipItem', equipSlot: slot } })
            }}
          >
            <span className="equipment-label">{label}</span>
            {stack ? <ItemIcon stack={stack} /> : <span className="equipment-empty">-</span>}
          </button>
        )
      })}
    </div>
  )
}

const SkillsPanel = ({ you }: Pick<Props, 'you'>) => (
  <div className="skills-panel" aria-label="Skills">
    {SKILLS.map((skill) => {
      const xp = you.skills[skill]
      const level = levelForXp(xp)
      return (
        <div key={skill} className="skill-row" title={`${Math.floor(xp)} xp`}>
          <span className="skill-name">{SKILL_LABELS[skill]}</span>
          <span className="skill-level">{level}</span>
        </div>
      )
    })}
  </div>
)

export const SidePanel = (props: Props) => {
  const [tab, setTab] = useState<Tab>('inventory')
  const tabs: ReadonlyArray<{ id: Tab; label: string }> = [
    { id: 'inventory', label: 'Inventory' },
    { id: 'equipment', label: 'Equipment' },
    { id: 'skills', label: 'Skills' },
  ]
  return (
    <div className="side-panel panel">
      <div className="hp-orb" title="Hitpoints">
        ❤ {props.you.hp}
      </div>
      <div className="side-tabs" role="tablist">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? 'side-tab active' : 'side-tab'}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'inventory' ? <InventoryGrid {...props} /> : null}
      {tab === 'equipment' ? <EquipmentPanel you={props.you} onAction={props.onAction} /> : null}
      {tab === 'skills' ? <SkillsPanel you={props.you} /> : null}
    </div>
  )
}
