# Command Palette

Keyboard-driven command interface (`Cmd/Ctrl + K`).

```mermaid
graph TB
    KB[Keyboard Cmd+K] --> CP[CommandPalette]
    CP --> UCP[useCommandPalette] --> CMD[commands.ts]
    UCP -->|execute| Actions[Store mutations]
    UCP -->|track| RS[(recentStore)]
    RS -->|recent first| CP
```

## Categories

`navigation` | `edit` | `layers` | `view` | `preview` | `bins` | `tools` | `export`

## Adding Commands

```typescript
// commands.ts - wired to actions at runtime
{
  id: 'undo',
  labelKey: 'commandPalette.undo',  // i18n key
  category: 'edit',
  shortcut: { keys: 'Z', modifier: true },
  action: () => undo(),
}
```

## Integration

- Labels use i18n translation keys
- Shortcuts from `@/core/constants.SHORTCUTS`
- Recent commands persisted to localStorage
