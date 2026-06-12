import { ITEMS, type ClientMessage, type ItemStack } from '@osrs/shared'

type Props = Readonly<{
  bank: readonly ItemStack[]
  inventory: readonly (ItemStack | null)[]
  onSend: (message: ClientMessage) => void
  onClose: () => void
}>

const StackIcon = ({ stack }: { stack: ItemStack }) => (
  <span className={`item-icon item-${stack.itemId}`}>
    <span className="item-glyph" />
    {stack.quantity > 1 ? <span className="item-quantity">{stack.quantity}</span> : null}
  </span>
)

export const BankPanel = ({ bank, inventory, onSend, onClose }: Props) => (
  <div className="bank-panel panel">
    <div className="bank-header">
      <h2>Bank of Gielinor</h2>
      <button type="button" className="bank-close" onClick={onClose}>
        Close
      </button>
    </div>
    <div className="bank-grid" aria-label="Bank items">
      {bank.length === 0 ? <p className="bank-empty">Your bank is empty.</p> : null}
      {bank.map((stack, index) => (
        <button
          key={stack.itemId}
          className="bank-slot"
          aria-label={`Withdraw ${ITEMS[stack.itemId].name} x${stack.quantity}`}
          title={`${ITEMS[stack.itemId].name} x${stack.quantity}`}
          onClick={() => onSend({ type: 'withdrawItem', bankIndex: index, amount: 1 })}
          onContextMenu={(event) => {
            event.preventDefault()
            onSend({ type: 'withdrawItem', bankIndex: index, amount: 'all' })
          }}
        >
          <StackIcon stack={stack} />
        </button>
      ))}
    </div>
    <div className="bank-divider">Inventory - click to deposit, right-click for all</div>
    <div className="bank-grid" aria-label="Inventory items">
      {inventory.map((stack, slot) =>
        stack ? (
          <button
            key={slot}
            className="bank-slot"
            aria-label={`Deposit ${ITEMS[stack.itemId].name} x${stack.quantity}`}
            title={`${ITEMS[stack.itemId].name} x${stack.quantity}`}
            onClick={() => onSend({ type: 'depositItem', slot, amount: 1 })}
            onContextMenu={(event) => {
              event.preventDefault()
              onSend({ type: 'depositItem', slot, amount: 'all' })
            }}
          >
            <StackIcon stack={stack} />
          </button>
        ) : null,
      )}
    </div>
  </div>
)
