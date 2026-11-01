/**
 * A play dot beside a designer feature. Hovering it (or tapping it) opens a
 * card with a short looping clip of the feature at work, a one-line caption,
 * and the feature's evergreen explanation, if it has one.
 */

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useSettingsStore } from '@/core/store';
import { IconButton, cn } from '@/design-system';
import { PlayCircleIcon } from '@/design-system/Icon';
import { useTranslation } from '@/i18n';
import { InfoDot } from '@/shared/components/InfoDot';
import { useResolvedTheme } from '@/shared/hooks/useThemeEffect';
import { FEATURE_TIPS } from '../../data/featureTips';
import type { FeatureTipChip, FeatureTipId } from '../../data/featureTips';

const HOVER_DELAY_MS = 400;

export interface FeatureTipProps {
  readonly tip: FeatureTipId;
  /** The feature's name, for the dot's accessible label. */
  readonly feature: string;
  /** An evergreen explanation that would otherwise sit behind its own info dot. */
  readonly detail?: ReactNode;
}

export function FeatureTip({ tip, feature, detail }: FeatureTipProps) {
  const t = useTranslation();
  return (
    <InfoDot
      aria-label={t('binDesigner.featureTip.watch', { feature })}
      icon={<PlayCircleIcon size="xs" />}
      hoverDelayMs={HOVER_DELAY_MS}
      panelClassName="w-[296px] max-h-[min(80vh,34rem)] overflow-y-auto p-2"
    >
      <FeatureTipCard tip={tip} detail={detail} />
    </InfoDot>
  );
}

function chipAt(chips: readonly FeatureTipChip[], seconds: number): number {
  let index = 0;
  chips.forEach((chip, i) => {
    if (seconds >= chip.fromSeconds) index = i;
  });
  return index;
}

function FeatureTipCard({ tip, detail }: { tip: FeatureTipId; detail?: ReactNode }) {
  const t = useTranslation();
  const theme = useResolvedTheme();
  const reduceMotion = useSettingsStore((s) => s.settings.reduceMotion);
  const { captionKey, clips, chips } = FEATURE_TIPS[tip];
  const clip = clips[theme];
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [refused, setRefused] = useState(false);
  const [chip, setChip] = useState(0);

  // Started from code rather than `autoPlay`: React sets `muted` as a property
  // only, and a browser that checks the attribute refuses to autoplay. A
  // refusal leaves the poster and the play button.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (reduceMotion) {
      video.pause();
      return;
    }
    video.muted = true;
    video.play().catch(() => setRefused(true));
  }, [reduceMotion, clip.video]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !chips || !playing) return;
    let frame = requestAnimationFrame(function sync() {
      setChip(chipAt(chips, video.currentTime));
      frame = requestAnimationFrame(sync);
    });
    return () => cancelAnimationFrame(frame);
  }, [chips, playing]);

  const play = (): void => {
    const video = videoRef.current;
    if (!video) return;
    // The button disappears once the clip plays, so hand focus to the frame
    // first or a keyboard user is dropped out of the card.
    frameRef.current?.focus();
    video.muted = true;
    video.play().catch(() => setRefused(true));
  };

  return (
    <div className="space-y-2">
      <div
        ref={frameRef}
        tabIndex={-1}
        className="relative overflow-hidden rounded-md outline-none"
      >
        <video
          ref={videoRef}
          src={clip.video}
          poster={clip.poster}
          muted
          loop
          playsInline
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          // A new source (the theme changed) stops playback without a pause event.
          onEmptied={() => setPlaying(false)}
          preload={reduceMotion ? 'none' : 'auto'}
          aria-hidden="true"
          className="block aspect-[4/3] w-full"
        />
        {!playing && (reduceMotion || refused) && (
          <IconButton
            type="button"
            variant="ghost"
            onClick={play}
            aria-label={t('binDesigner.featureTip.play')}
            className="absolute inset-0 m-auto h-12 w-12 rounded-full bg-surface/80 text-content shadow-md hover:bg-surface"
          >
            <PlayCircleIcon size="lg" />
          </IconButton>
        )}
      </div>
      {chips && (
        <div className="flex flex-wrap gap-1 px-1">
          {chips.map((c, i) => (
            <span
              key={c.labelKey}
              aria-current={playing && i === chip ? 'true' : undefined}
              className={cn(
                'rounded-full px-2 py-0.5 text-micro font-medium transition-colors',
                playing && i === chip ? 'bg-accent/15 text-accent' : 'text-content-tertiary'
              )}
            >
              {t(c.labelKey)}
            </span>
          ))}
        </div>
      )}
      <p className="px-1 text-xs leading-relaxed text-content-secondary">{t(captionKey)}</p>
      {detail !== undefined && (
        <div className="border-t border-stroke-subtle px-1 pt-2 text-xs leading-relaxed text-content-tertiary">
          {typeof detail === 'string' ? <p>{detail}</p> : detail}
        </div>
      )}
    </div>
  );
}
