'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useId,
  useRef,
  useState,
} from 'react';

import { cn } from '@/lib/utils';

import './sheet.css';

/**
 * The bottom sheet that grows over the map.
 *
 * The rests are an ordered list and nothing outside this file reads their names, so the
 * trail position the next prompt needs is one more entry here and one more branch in
 * whatever renders the body. `peek` is where the map opens: one line and a handle, and the
 * map has the screen.
 */
export const SHEET_RESTS = ['peek', 'summary', 'list'] as const;

export type SheetRest = (typeof SHEET_RESTS)[number];

const LOWEST = SHEET_RESTS[0];
const HIGHEST = SHEET_RESTS[SHEET_RESTS.length - 1];

/**
 * How much of the sheet is showing at each rest.
 *
 * `peek` is the handle plus one line, and it is the only one expressed in rem: it has to
 * hold a 48 px target whatever the viewport is. The two taller rests are a share of the
 * viewport, so a 568 px screen and a 932 px screen each get a sheet in proportion to the
 * map behind it. No fixed pixel width anywhere, and no fixed pixel height above the target.
 */
const REST_HEIGHT: Record<SheetRest, string> = {
  peek: '7rem',
  summary: '42dvh',
  list: '88dvh',
};

/** The share of the viewport the element itself occupies, which is the tallest rest. */
const MAX_DVH = Number.parseFloat(REST_HEIGHT.list);

/** Below this much movement the pointer tapped the header rather than dragged it. */
const DRAG_THRESHOLD_PX = 6;

interface SheetApi {
  rest: SheetRest;
  setRest: (rest: SheetRest) => void;
}

const SheetContext = createContext<SheetApi | null>(null);

/** Lets a page raise the sheet, which is how the massif summary opens the trail list. */
export function useSheet(): SheetApi {
  const api = useContext(SheetContext);
  if (api === null) throw new Error('useSheet needs a SheetProvider above it.');
  return api;
}

export function SheetProvider({
  value,
  children,
}: {
  value: SheetApi;
  children: ReactNode;
}): ReactNode {
  return <SheetContext.Provider value={value}>{children}</SheetContext.Provider>;
}

interface BottomSheetProps {
  rest: SheetRest;
  onRestChange: (rest: SheetRest) => void;
  /** Names the region. Not a dialog: nothing is trapped and the map stays reachable. */
  label: string;
  children: ReactNode;
}

export function BottomSheet({
  rest,
  onRestChange,
  label,
  children,
}: BottomSheetProps): ReactNode {
  const bodyId = useId();
  const sheet = useRef<HTMLElement>(null);
  const drag = useRef<{ startY: number; startHeight: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);

  const atTop = rest === HIGHEST;

  const step = useCallback(
    (direction: 1 | -1) => {
      const next = SHEET_RESTS.indexOf(rest) + direction;
      if (next >= 0 && next < SHEET_RESTS.length) onRestChange(SHEET_RESTS[next]);
    },
    [rest, onRestChange],
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const element = sheet.current;
    if (element === null) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const max = element.getBoundingClientRect().height;
    drag.current = {
      startY: event.clientY,
      startHeight: max - shiftOf(element),
      moved: false,
    };
  };

  /*
   * The pointer is captured on the first real movement and not on the press.
   * Capturing on press retargets every later pointer event, and with it the click, to this
   * wrapper, so the handle inside it never hears the tap and the sheet only ever responds
   * to a drag. Measured on 2026-09-20: pressing the handle changed nothing at all.
   */
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const state = drag.current;
    const element = sheet.current;
    if (state === null || element === null) return;

    const delta = state.startY - event.clientY;
    if (!state.moved) {
      if (Math.abs(delta) <= DRAG_THRESHOLD_PX) return;
      state.moved = true;
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    const max = element.getBoundingClientRect().height;
    const shown = Math.min(max, Math.max(0, state.startHeight + delta));
    element.style.setProperty('--sheet-rest-drag', `${shown}px`);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const state = drag.current;
    const element = sheet.current;
    drag.current = null;
    if (state === null || element === null || !state.moved) return;

    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const max = element.getBoundingClientRect().height;
    const shown = max - shiftOf(element);
    element.style.removeProperty('--sheet-rest-drag');
    onRestChange(nearestRest(shown, max));
  };

  const onHandleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      step(1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      step(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      onRestChange(LOWEST);
    } else if (event.key === 'End') {
      event.preventDefault();
      onRestChange(HIGHEST);
    }
  };

  const onSheetKeyDown = (event: ReactKeyboardEvent<HTMLElement>): void => {
    if (event.key !== 'Escape' || rest === LOWEST) return;
    event.preventDefault();
    onRestChange(LOWEST);
  };

  const Chevron = atTop ? ChevronDown : ChevronUp;

  return (
    <section
      ref={sheet}
      aria-label={label}
      data-rest={rest}
      data-dragging={dragging}
      onKeyDown={onSheetKeyDown}
      style={{ '--sheet-rest': REST_HEIGHT[rest] } as Record<string, string>}
      className={cn(
        'treeline-sheet pointer-events-auto fixed inset-x-0 bottom-0 z-20 flex flex-col',
        'rounded-t-lg border-t bg-card text-card-foreground',
        // A desk browser does not need a 1400 px wide sheet over a 1400 px wide map.
        'md:right-auto md:left-3 md:w-[min(26rem,calc(100%-1.5rem))]',
      )}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="shrink-0 touch-none"
      >
        <button
          type="button"
          aria-expanded={atTop}
          aria-controls={bodyId}
          onClick={() => onRestChange(atTop ? LOWEST : HIGHEST)}
          onKeyDown={onHandleKeyDown}
          className={cn(
            'flex min-h-13 w-full items-center justify-center gap-2 rounded-t-lg px-4',
            'text-muted-foreground active:translate-y-px',
          )}
        >
          <span aria-hidden className="h-1 w-10 rounded-full bg-border" />
          <Chevron aria-hidden className="size-4" />
          <span className="sr-only">{atTop ? 'Lower the panel' : 'Raise the panel'}</span>
        </button>
      </div>

      <div
        id={bodyId}
        /*
         * Tabbing into the panel opens it. At the lowest rest the body is one line tall and
         * cannot scroll, so a keyboard reaching a control further down would land on
         * something nobody can see, and a focus ring nobody can see is the same as no focus
         * ring. Raising the sheet is also what the reader was asking for by tabbing there.
         */
        onFocus={() => {
          if (rest === LOWEST) onRestChange(SHEET_RESTS[1]);
        }}
        className="treeline-sheet-body min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8"
      >
        {children}
      </div>
    </section>
  );
}

/**
 * Roughly how much of the screen a rest covers, for whoever has to keep something clear of
 * it. The map uses it to pad `fitBounds` so a massif does not open underneath the sheet.
 */
export function restHeightPx(rest: SheetRest): number {
  const length = REST_HEIGHT[rest];
  if (length.endsWith('dvh')) return (Number.parseFloat(length) / 100) * window.innerHeight;

  const root = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.parseFloat(length) * (Number.isFinite(root) ? root : 16);
}

/** How far down the sheet currently sits, read off the element so a drag can start mid move. */
function shiftOf(element: HTMLElement): number {
  return new DOMMatrixReadOnly(getComputedStyle(element).transform).m42;
}

function nearestRest(shown: number, max: number): SheetRest {
  let closest: SheetRest = LOWEST;
  let best = Number.POSITIVE_INFINITY;

  for (const rest of SHEET_RESTS) {
    const distance = Math.abs(restHeight(rest, max) - shown);
    if (distance < best) {
      best = distance;
      closest = rest;
    }
  }
  return closest;
}

/** `6rem` and `42dvh` in pixels. The element is `MAX_DVH` tall, so it measures its own unit. */
function restHeight(rest: SheetRest, max: number): number {
  const length = REST_HEIGHT[rest];
  if (length.endsWith('dvh')) return (Number.parseFloat(length) / MAX_DVH) * max;

  const root = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.parseFloat(length) * (Number.isFinite(root) ? root : 16);
}
