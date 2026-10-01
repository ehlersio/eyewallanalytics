// components/SwipeToDelete.jsx -- a list row that can be removed: swipe it
// left on a touch screen to show a red delete button behind it (swipe far
// enough and it goes on its own), or use the × that shows on hover with a
// mouse. Used by the bell's Recent alerts.
//
// react-swipeable reads the gesture. Its preventScrollOnSwipe would also
// block the sheet's vertical scroll (it cancels every move once a swipe
// handler is set), so `touch-action: pan-y` leaves vertical moves to the
// browser instead, and a gesture that starts out vertical is ignored here.
import { useRef, useState } from 'react';
import { useSwipeable } from 'react-swipeable';
import { Trash2, X } from 'lucide-react';

const REVEAL = 76;        // px: the delete button's width when swiped open
const FULL_SWIPE = 0.55;  // of the row's width: let go past this and it's gone

const WRAP_CLASSES = 'swipe-row group relative overflow-hidden [touch-action:pan-y]';
const BEHIND_CLASSES = 'absolute inset-0 flex justify-end bg-[var(--red)]';
const DELETE_CLASSES = 'swipe-row-delete h-full flex items-center justify-center border-0 bg-transparent text-white cursor-pointer';
const FRONT_CLASSES = 'relative bg-[var(--bg2)]';
const SLIDE_CLASSES = '[transition:transform_0.2s_ease]';
// Mouse/trackpad only: shows on hover or keyboard focus, never on touch,
// where the swipe does the job.
const X_CLASSES = 'swipe-row-x absolute top-1/2 -translate-y-1/2 right-2 w-7 h-7 rounded-full border-0 flex items-center justify-center '
  + 'bg-[var(--bg3)] text-[color:var(--text-muted)] cursor-pointer hover:text-[color:var(--text)] '
  + 'opacity-0 pointer-events-none focus-visible:opacity-100 focus-visible:pointer-events-auto '
  + '[@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-hover:pointer-events-auto';

export default function SwipeToDelete({ onDelete, deleteLabel, children }) {
  const wrapRef = useRef(null);
  const axisRef = useRef(null); // 'x' | 'y' for the gesture under way
  const [offset, setOffset] = useState(0); // ≤ 0
  const [dragging, setDragging] = useState(false);
  const [open, setOpen] = useState(false);
  const [gone, setGone] = useState(false);

  const width = () => wrapRef.current?.offsetWidth || 320;
  const remove = () => {
    setGone(true);
    setOffset(-width());
    setTimeout(onDelete, 180); // let it slide out first
  };
  const start = () => (open ? -REVEAL : 0);

  const handlers = useSwipeable({
    delta: 8,
    onSwiping: e => {
      if (e.first) axisRef.current = e.absX > e.absY ? 'x' : 'y';
      if (axisRef.current !== 'x' || gone) return;
      setDragging(true);
      setOffset(Math.min(0, start() + e.deltaX));
    },
    onSwiped: e => {
      const wasX = axisRef.current === 'x';
      axisRef.current = null;
      if (!wasX || gone) return;
      setDragging(false);
      const end = Math.min(0, start() + e.deltaX);
      if (-end > width() * FULL_SWIPE) { remove(); return; }
      const keepOpen = -end > REVEAL / 2;
      setOpen(keepOpen);
      setOffset(keepOpen ? -REVEAL : 0);
    },
  });

  // A tap on a swiped-open row closes it rather than opening the row.
  const onClickCapture = e => {
    if (!open) return;
    e.stopPropagation();
    e.preventDefault();
    setOpen(false);
    setOffset(0);
  };

  const { ref: swipeRef, ...swipeHandlers } = handlers;
  return (
    <div
      ref={el => { wrapRef.current = el; swipeRef(el); }}
      className={WRAP_CLASSES}
      {...swipeHandlers}
    >
      {offset < 0 && (
        <div className={BEHIND_CLASSES} aria-hidden={!open}>
          <button
            type="button"
            className={DELETE_CLASSES}
            style={{ width: Math.max(REVEAL, -offset) }}
            onClick={remove}
            aria-label={deleteLabel}
            tabIndex={open ? 0 : -1}
          >
            <Trash2 size={20} aria-hidden="true" />
          </button>
        </div>
      )}
      <div
        className={`${FRONT_CLASSES} ${dragging ? '' : SLIDE_CLASSES}`}
        style={offset ? { transform: `translateX(${offset}px)` } : undefined}
        onClickCapture={onClickCapture}
      >
        {children}
        <button type="button" className={X_CLASSES} onClick={remove} aria-label={deleteLabel}>
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
