# Modal Components Usage

## HelpModal

Displays keyboard shortcuts and mouse interactions reference.

```tsx
import { HelpModal } from './components/Modals';

function App() {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <>
      <button onClick={() => setShowHelp(true)}>Help</button>
      <HelpModal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
      />
    </>
  );
}
```

**Features:**
- Automatically displays keyboard shortcuts from SHORTCUTS constant
- Detects OS for Cmd/Ctrl display
- Lists mouse interactions for grid operations
- Closes on Escape key or backdrop click

## ImportModal

JSON import with validation and preview.

```tsx
import { ImportModal } from './components/Modals';
import { useLayoutStore } from './store';

function App() {
  const [showImport, setShowImport] = useState(false);
  const setLayout = useLayoutStore(state => state.setLayout);

  return (
    <>
      <button onClick={() => setShowImport(true)}>Import</button>
      <ImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onImport={(layout) => {
          setLayout(layout);
          // Layout is imported!
        }}
      />
    </>
  );
}
```

**Features:**
- Paste JSON or upload .json file
- Real-time validation with error display (red)
- Preview showing drawer size, layer count, bin count (green)
- Import button disabled when errors present
- Uses validateImport() from utils/validation

## ConfirmDialog

Generic confirmation dialog for destructive actions.

```tsx
import { ConfirmDialog } from './components/Modals';
import { useLayoutStore } from './store';

function LayerPanel() {
  const [showConfirm, setShowConfirm] = useState(false);
  const deleteLayer = useLayoutStore(state => state.deleteLayer);

  return (
    <>
      <button onClick={() => setShowConfirm(true)}>Delete Layer</button>
      <ConfirmDialog
        isOpen={showConfirm}
        title="Delete Layer?"
        message="This will permanently delete the layer and all bins on it."
        confirmText="Delete"
        cancelText="Cancel"
        destructive={true}
        onConfirm={() => {
          deleteLayer(layerId);
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
```

**Props:**
- `isOpen`: boolean - Show/hide modal
- `title`: string - Dialog title
- `message`: string - Dialog message/description
- `confirmText?`: string - Confirm button text (default: "Confirm")
- `cancelText?`: string - Cancel button text (default: "Cancel")
- `destructive?`: boolean - Use red button for confirm (default: false)
- `onConfirm`: () => void - Called when confirm clicked
- `onCancel`: () => void - Called when cancel clicked or Escape pressed

**Use cases:**
- Delete layer
- Clear layer (remove all bins)
- Delete bin
- Clear all bins
- Reset layout

## Styling

All modals use consistent styling:
- Dark backdrop: `bg-black/50`
- Modal background: `bg-zinc-800`
- Rounded corners with padding
- Close on Escape key
- Click backdrop to dismiss
- Smooth transitions

## Focus Trap

All modals stop event propagation on the modal container, so clicking inside won't close the modal. Only backdrop clicks or Escape key will dismiss.
