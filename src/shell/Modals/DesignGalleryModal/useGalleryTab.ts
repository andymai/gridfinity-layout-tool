import { useState, useCallback } from 'react';

const GALLERY_TAB_STORAGE_KEY = 'gridfinity-design-gallery-tab-v1';
const COMMUNITY_TAB_OPENED_KEY = 'gridfinity-design-gallery-community-opened-v1';

export type GalleryTabId = 'examples' | 'community';

export const GALLERY_TAB_ORDER: readonly GalleryTabId[] = ['examples', 'community'];

function isValidTab(value: unknown): value is GalleryTabId {
  return value === 'examples' || value === 'community';
}

function loadStoredTab(): GalleryTabId | null {
  try {
    const stored = localStorage.getItem(GALLERY_TAB_STORAGE_KEY);
    return isValidTab(stored) ? stored : null;
  } catch {
    return null;
  }
}

function saveStoredTab(tab: GalleryTabId): void {
  try {
    localStorage.setItem(GALLERY_TAB_STORAGE_KEY, tab);
    if (tab === 'community') {
      localStorage.setItem(COMMUNITY_TAB_OPENED_KEY, 'true');
    }
  } catch {
    // Private browsing or quota: the modal just defaults to Examples next time.
  }
}

function hasCommunityBeenOpened(): boolean {
  try {
    return localStorage.getItem(COMMUNITY_TAB_OPENED_KEY) === 'true';
  } catch {
    return false;
  }
}

export interface UseGalleryTab {
  activeTab: GalleryTabId;
  setActiveTab: (tab: GalleryTabId) => void;
  showNewDot: boolean;
}

export function useGalleryTab(): UseGalleryTab {
  const [activeTab, setActiveTabState] = useState<GalleryTabId>(
    () => loadStoredTab() ?? 'examples'
  );
  const [communityOpened, setCommunityOpened] = useState<boolean>(hasCommunityBeenOpened);

  const setActiveTab = useCallback((tab: GalleryTabId) => {
    setActiveTabState(tab);
    if (tab === 'community') {
      setCommunityOpened(true);
    }
    saveStoredTab(tab);
  }, []);

  return { activeTab, setActiveTab, showNewDot: !communityOpened };
}
