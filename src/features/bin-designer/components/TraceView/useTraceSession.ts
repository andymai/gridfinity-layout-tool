import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isOk } from '@/core/result';
import {
  decodeImageToCanvas,
  detectReference,
  imageDataFromCanvas,
  preloadSegmenter,
  withCardSize,
  withReference,
  type ImageDataLike,
  type Point,
  type SceneReference,
  type SceneShape,
  type SceneTrace,
  type SceneTraceOptions,
} from '@/shared/scanTrace';
import {
  cardOptions,
  loadCardSize,
  saveCardSize,
  shownShapes,
  svgFromShapes,
  traceAll,
  traceTap,
  withoutShape,
  type CardSizeMm,
} from '@/shared/scanReview';

export interface TracePhoto {
  /** The decoded, downscaled photo: the model's input and the tracer's frame. */
  readonly canvas: HTMLCanvasElement;
  readonly image: ImageDataLike;
  readonly url: string;
}

interface Session {
  readonly photo: TracePhoto | null;
  readonly loading: boolean;
  readonly failed: boolean;
  readonly scene: SceneTrace | null;
  /** The scene before the last change, so a bad redraw can be undone. */
  readonly previous: SceneTrace | null;
  readonly canRefine: boolean;
  /** A trace or redraw is under way, so the outlines must hold still. */
  readonly working: boolean;
  /** The photo's own reference, kept while one the user set stands in for it. */
  readonly auto: SceneReference | null;
  /** The scene's reference is one the user set, so a tap must not re-solve it. */
  readonly manual: boolean;
  readonly region: readonly Point[] | null;
  readonly sensitivity: number;
}

const START: Session = {
  photo: null,
  loading: false,
  failed: false,
  scene: null,
  previous: null,
  canRefine: true,
  working: false,
  auto: null,
  manual: false,
  region: null,
  sensitivity: 0,
};

/** A scene with no tools yet, sized by `reference`, for a tap to add to. */
function emptyScene(reference: SceneReference | null, options: SceneTraceOptions): SceneTrace {
  const blank = { shapes: [], units: 'px', card: null, grid: null, reference: null } as const;
  return withReference(blank, reference, options);
}

/** Marked paper is where the tools are looked for, so it changes what a trace finds. */
const searchesPaper = (reference: SceneReference | null): boolean => reference?.kind === 'paper';

export interface TraceSession {
  readonly photo: TracePhoto | null;
  readonly loading: boolean;
  readonly failed: boolean;
  readonly working: boolean;
  readonly canRefine: boolean;
  /** The scene as shown: card-sized, every tool still in it. */
  readonly scene: SceneTrace | null;
  /** The tools the list shows and Add sends. */
  readonly shapes: readonly SceneShape[];
  readonly holesFound: boolean;
  readonly canUndo: boolean;
  readonly manual: boolean;
  readonly hasAuto: boolean;
  readonly region: readonly Point[] | null;
  readonly sensitivity: number;
  readonly keepHoles: boolean;
  readonly cardSize: CardSizeMm;
  readonly load: (file: Blob) => Promise<void>;
  readonly setRegion: (region: readonly Point[] | null) => void;
  readonly setSensitivity: (value: number) => void;
  readonly commitSensitivity: (value: number) => void;
  readonly setScale: (reference: SceneReference | null) => void;
  readonly tap: (seed: Point) => void;
  readonly remove: (index: number) => void;
  readonly undo: () => void;
  readonly setKeepHoles: (keep: boolean) => void;
  readonly setCardSize: (size: CardSizeMm) => void;
  /** The shown tools as the SVG the phone would upload, or null when they cannot be added. */
  readonly traced: () => string | null;
}

export function useTraceSession(): TraceSession {
  const [session, setSession] = useState<Session>(START);
  const [keepHoles, setKeepHoles] = useState(false);
  const [cardSize, setCardSizeState] = useState<CardSizeMm>(loadCardSize);
  // Each pass takes a ticket; a result lands only while its ticket is the latest,
  // so a photo, region or scale changed mid-pass never takes a stale outline.
  const ticket = useRef(0);

  useEffect(() => {
    preloadSegmenter();
  }, []);

  const photoUrl = session.photo?.url ?? null;
  useEffect(() => {
    if (!photoUrl) return;
    return () => URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  const options = useCallback(
    (region: readonly Point[] | null, sensitivity: number): SceneTraceOptions => ({
      ...cardOptions(cardSize),
      sensitivity,
      ...(region ? { region } : {}),
    }),
    [cardSize]
  );

  const load = useCallback(
    async (file: Blob) => {
      const mine = ++ticket.current;
      setSession((s) => ({ ...s, loading: true, failed: false }));
      let canvas: HTMLCanvasElement;
      try {
        canvas = await decodeImageToCanvas(file);
      } catch {
        if (mine === ticket.current) setSession((s) => ({ ...s, loading: false, failed: true }));
        return;
      }
      const image = imageDataFromCanvas(canvas);
      const opts = options(null, 0);
      const auto = detectReference(image, opts);
      const traced = await traceAll(canvas, image, opts, auto);
      if (mine !== ticket.current) return;
      setSession({
        ...START,
        photo: { canvas, image, url: URL.createObjectURL(file) },
        scene: isOk(traced) ? traced.value.scene : emptyScene(auto, opts),
        canRefine: isOk(traced) ? traced.value.canRefine : true,
        auto,
      });
    },
    [options]
  );

  const retrace = useCallback(
    (
      region: readonly Point[] | null,
      sensitivity: number,
      reference: SceneReference | null,
      manual: boolean
    ) => {
      const { photo, scene } = session;
      if (!photo || !scene) return;
      const mine = ++ticket.current;
      setSession((s) => ({ ...s, region, sensitivity, working: true }));
      const opts = options(region, sensitivity);
      void traceAll(photo.canvas, photo.image, opts, reference).then((traced) => {
        if (mine !== ticket.current) return;
        setSession((s) => ({
          ...s,
          scene: isOk(traced) ? traced.value.scene : emptyScene(reference, opts),
          previous: s.scene,
          canRefine: isOk(traced) ? traced.value.canRefine && s.canRefine : s.canRefine,
          manual,
          working: false,
        }));
      });
    },
    [session, options]
  );

  const reference = session.scene?.reference ?? null;

  const setRegion = useCallback(
    (region: readonly Point[] | null) =>
      retrace(region, session.sensitivity, reference, session.manual),
    [retrace, session.sensitivity, session.manual, reference]
  );

  const setSensitivity = useCallback(
    (value: number) => setSession((s) => ({ ...s, sensitivity: value })),
    []
  );
  const commitSensitivity = useCallback(
    (value: number) => retrace(session.region, value, reference, session.manual),
    [retrace, session.region, session.manual, reference]
  );

  // A hand-set scale re-sizes the outlines in place, keeping every edit; one
  // that moves where the tools are looked for traces them again.
  const setScale = useCallback(
    (next: SceneReference | null) => {
      const { scene, region, sensitivity } = session;
      if (!scene) return;
      const manual = next !== null;
      const auto = session.manual ? session.auto : scene.reference;
      const target = next ?? auto;
      if (region === null && (searchesPaper(target) || searchesPaper(scene.reference))) {
        setSession((s) => ({ ...s, auto }));
        retrace(region, sensitivity, target, manual);
        return;
      }
      ++ticket.current;
      setSession((s) => ({
        ...s,
        auto,
        manual,
        working: false,
        previous: scene,
        scene: withReference(scene, target, options(region, sensitivity)),
      }));
    },
    [session, retrace, options]
  );

  const tap = useCallback(
    (seed: Point) => {
      const { photo, scene, region, sensitivity, manual, canRefine, working } = session;
      if (!photo || !scene || !canRefine || working) return;
      const mine = ++ticket.current;
      setSession((s) => ({ ...s, working: true }));
      void traceTap(
        photo.canvas,
        photo.image,
        scene,
        seed,
        options(region, sensitivity),
        manual
      ).then((next) => {
        if (mine !== ticket.current) return;
        setSession((s) =>
          isOk(next)
            ? { ...s, scene: next.value, previous: s.scene, working: false }
            : { ...s, canRefine: next.error !== 'modelFailed', working: false }
        );
      });
    },
    [session, options]
  );

  const sized = useMemo(
    () => (session.scene ? withCardSize(session.scene, cardSize.longMm, cardSize.shortMm) : null),
    [session.scene, cardSize]
  );
  const listed = useMemo(
    () => (sized ? shownShapes(sized.shapes, keepHoles, sized.units) : []),
    [sized, keepHoles]
  );

  const remove = useCallback(
    (index: number) => {
      const { scene, working } = session;
      const at = listed.at(index);
      if (!scene || working || !at) return;
      const gone = scene.shapes[at.index];
      setSession((s) => ({
        ...s,
        scene: { ...scene, shapes: withoutShape(scene.shapes, gone) },
        previous: scene,
      }));
    },
    [session, listed]
  );

  const undo = useCallback(
    () =>
      setSession((s) =>
        s.previous && !s.working ? { ...s, scene: s.previous, previous: null } : s
      ),
    []
  );

  const setCardSize = useCallback((size: CardSizeMm) => {
    setCardSizeState(size);
    saveCardSize(size);
  }, []);

  const shapes = useMemo(() => listed.map(({ shape }) => shape), [listed]);

  const traced = useCallback((): string | null => {
    if (!sized || sized.units !== 'mm' || shapes.length === 0 || session.working) return null;
    return svgFromShapes(shapes, 'mm', keepHoles);
  }, [sized, shapes, keepHoles, session.working]);

  return {
    photo: session.photo,
    loading: session.loading,
    failed: session.failed,
    working: session.working,
    canRefine: session.canRefine,
    scene: sized,
    shapes,
    holesFound: sized?.shapes.some((s) => (s.holes?.length ?? 0) > 0 || s.inHole) ?? false,
    canUndo: session.previous !== null && !session.working,
    manual: session.manual,
    hasAuto: (session.manual ? session.auto : reference) !== null,
    region: session.region,
    sensitivity: session.sensitivity,
    keepHoles,
    cardSize,
    load,
    setRegion,
    setSensitivity,
    commitSensitivity,
    setScale,
    tap,
    remove,
    undo,
    setKeepHoles,
    setCardSize,
    traced,
  };
}
