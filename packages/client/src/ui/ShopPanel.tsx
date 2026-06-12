import { buyPrice, ITEMS, sellPrice, type ClientMessage, type ItemStack } from '@osrs/shared'

type ShopEntry = Readonly<{ itemId: ItemStack['itemId']; quantity: number }>

type Props = Readonly<{
  shop: readonly ShopEntry[]
  inventory: readonly (ItemStack | null)[]
  onSend: (message: ClientMessage) => void
  onClose: () => void
}>

const StackIcon = ({ stack }: { stack: ShopEntry }) => (
  <span className={`item-icon item-${stack.itemId}`}>
    <span className="item-glyph" />
    <span className="item-quantity">{stack.quantity}</span>
  </span>
)

export const ShopPanel = ({ shop, inventory, onSend, onClose }: Props) => (
  <div className="bank-panel panel">
    <div className="bank-header">
      <h2>General Store</h2>
      <button type="button" className="bank-close" onClick={onClose}>
        Close
      </button>
    </div>
    <div className="bank-grid" aria-label="Shop stock">
      {shop.length === 0 ? <p className="bank-empty">The shelves are bare.</p> : null}
      {shop.map((entry) => (
        <button
          key={entry.itemId}
          className="bank-slot"
          aria-label={`Buy ${ITEMS[entry.itemId].name} for ${buyPrice(entry.itemId)} coins (${entry.quantity} in stock)`}
          title={`${ITEMS[entry.itemId].name} - ${buyPrice(entry.itemId)} coins`}
          onClick={() => onSend({ type: 'buyItem', itemId: entry.itemId, amount: 1 })}
          onContextMenu={(event) => {
            event.preventDefault()
            onSend({ type: 'buyItem', itemId: entry.itemId, amount: 5 })
          }}
        >
          <StackIcon stack={entry} />
        </button>
      ))}
    </div>
    <div className="bank-divider">Inventory - click to sell, right-click to sell all</div>
    <div className="bank-grid" aria-label="Inventory items">
      {inventory.map((stack, slot) =>
        stack ? (
          <button
            key={slot}
            className="bank-slot"
            aria-label={`Sell ${ITEMS[stack.itemId].name} for ${sellPrice(stack.itemId)} coins`}
            title={`${ITEMS[stack.itemId].name} - sells for ${sellPrice(stack.itemId)} coins`}
            onClick={() => onSend({ type: 'sellItem', slot, amount: 1 })}
            onContextMenu={(event) => {
              event.preventDefault()
              onSend({ type: 'sellItem', slot, amount: 'all' })
            }}
          >
            <span className={`item-icon item-${stack.itemId}`}>
              <span className="item-glyph" />
              {stack.quantity > 1 ? <span className="item-quantity">{stack.quantity}</span> : null}
            </span>
          </button>
        ) : null,
      )}
    </div>
  </div>
)
