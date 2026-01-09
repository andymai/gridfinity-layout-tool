import { useUIStore, type MobilePanel } from '../../store/ui';

interface NavItem {
  id: MobilePanel;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    id: 'layers',
    label: 'Layers',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    id: 'inspector',
    label: 'Bin',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    id: 'categories',
    label: 'Categories',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
  },
  {
    id: 'print',
    label: 'List',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
];

/**
 * Bottom navigation bar for mobile layout.
 * Provides tabs for different panels that slide up as bottom sheets.
 */
export function BottomNavBar() {
  const activeMobilePanel = useUIStore(state => state.activeMobilePanel);
  const toggleMobilePanel = useUIStore(state => state.toggleMobilePanel);

  return (
    <nav
      className="bottom-nav flex items-stretch flex-shrink-0"
      style={{
        height: 'var(--bottom-nav-height)',
        backgroundColor: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-subtle)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {navItems.map((item) => {
        const isActive = activeMobilePanel === item.id;
        return (
          <button
            key={item.id}
            onClick={() => toggleMobilePanel(item.id)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
            style={{
              color: isActive ? 'var(--color-primary)' : 'var(--text-tertiary)',
              backgroundColor: isActive ? 'var(--bg-hover)' : 'transparent',
            }}
            aria-pressed={isActive}
            aria-label={`${item.label} panel`}
          >
            {item.icon}
            <span className="text-xs">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
