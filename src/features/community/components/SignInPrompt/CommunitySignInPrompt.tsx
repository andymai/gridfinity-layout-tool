import { Button, Dialog } from '@/design-system';
import { useTranslation } from '@/i18n';
import { signInUrl } from '@/core/sync/session/sessionApi';
import type { AuthProvider } from '@/core/sync/session/sessionApi';
import { useCommunityDetailStore } from '@/core/store/communityDetail';
import { saveCommunityReopenDesign, saveAuthReturnPath } from '@/shared/utils/communityReturnPath';

interface CommunitySignInPromptProps {
  open: boolean;
  /** One-line explanation of what signing in unlocks (like vs report copy). */
  message: string;
  onClose: () => void;
  /**
   * Runs before the OAuth redirect, on the actual provider choice: the like
   * flow stashes its pending action here. The report flow passes nothing and
   * is deliberately not resumed after OAuth (auto-submitting a report the
   * instant a redirect completes would be surprising).
   */
  onBeforeSignIn?: () => void;
}

function goTo(url: string): void {
  if (typeof window !== 'undefined') {
    window.location.href = url;
  }
}

/**
 * Small sign-in prompt for community actions that require a session (like,
 * report), reusing the publish dialog's two-provider button pattern.
 */
export function CommunitySignInPrompt({
  open,
  message,
  onClose,
  onBeforeSignIn,
}: CommunitySignInPromptProps) {
  const t = useTranslation();

  if (!open) return null;

  const handleSignIn = (provider: AuthProvider) => {
    // The OAuth callback lands on `/`; from the /community route surface the
    // return hook needs the origin stashed to restore the browsing context.
    if (typeof window !== 'undefined') {
      const path = window.location.pathname + window.location.search;
      saveAuthReturnPath(path);
      // The gallery-tab surface has no community URL to restore, so stash the
      // open detail instead: a report started there would otherwise dead-end
      // in the layout planner after the OAuth round trip.
      if (!path.startsWith('/community')) {
        const request = useCommunityDetailStore.getState().request;
        if (request !== null) saveCommunityReopenDesign(request.designId);
      }
    }
    onBeforeSignIn?.();
    goTo(signInUrl(provider));
  };

  return (
    <Dialog.Root open onClose={onClose} size="sm" mobilePresentation="sheet">
      <Dialog.Header title={t('community.signin.title')} closeAriaLabel={t('common.closeDialog')} />
      <Dialog.Body>
        <div className="space-y-4">
          <p className="text-sm text-content-secondary">{message}</p>
          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              className="min-h-11 md:min-h-0"
              onClick={() => handleSignIn('google')}
            >
              {t('auth.signInWithGoogle')}
            </Button>
            <Button
              variant="secondary"
              className="min-h-11 md:min-h-0"
              onClick={() => handleSignIn('github')}
            >
              {t('auth.signInWithGithub')}
            </Button>
          </div>
        </div>
      </Dialog.Body>
    </Dialog.Root>
  );
}
