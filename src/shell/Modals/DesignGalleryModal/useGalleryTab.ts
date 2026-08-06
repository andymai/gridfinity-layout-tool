import { useState, useCallback } from 'react';
import { useBinExampleGalleryStore } from '@/core/store/binExampleGallery';

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
  // The opener's request wins over the remembered tab: an entry point that
  // names a tab has to land on it. Read once at mount, which is per open,
  // since the modal only exists while the gallery is open.
  const [activeTab, setActiveTabState] = useState<GalleryTabId>(
    () => useBinExampleGalleryStore.getState().requestedTab ?? loadStoredTab() ?? 'examples'
  );
  // A stored active tab of 'community' implies it has been opened even if the
  // opened marker is missing, so the active tab never carries the New dot.
  const [communityOpened, setCommunityOpened] = useState<boolean>(
    () =>
      hasCommunityBeenOpened() ||
      loadStoredTab() === 'community' ||
      useBinExampleGalleryStore.getState().requestedTab === 'community'
  );

  const setActiveTab = useCallback((tab: GalleryTabId) => {
    setActiveTabState(tab);
    if (tab === 'community') {
      setCommunityOpened(true);
    }
    saveStoredTab(tab);
  }, []);

  return { activeTab, setActiveTab, showNewDot: !communityOpened };
}
