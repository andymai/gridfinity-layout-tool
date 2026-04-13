import { useFrame } from '@react-three/fiber';

interface BinTransitionTickerProps {
  tick: (delta: number) => boolean;
}

/**
 * Invisible R3F component that drives bin transition animations.
 * Must live inside a <Canvas> so useFrame is available.
 */
export function BinTransitionTicker({ tick }: BinTransitionTickerProps) {
  useFrame((_, delta) => {
    tick(delta);
  });
  return null;
}
