// components/FaceoffLoader.jsx
//
// Loading indicator: the two centers battling for the puck inside the
// faceoff circle, on a loop. Pass `label` to show loading copy under it;
// the label is also what screen readers announce.

import FaceoffRink from './FaceoffRink';
import { loaderFrame } from '../brand/faceoffTimeline';

const WRAP_CLASSES = 'faceoff-loader flex flex-col items-center justify-center gap-2';
const LABEL_CLASSES = 'text-[12px] text-[color:var(--text-dim)]';

export default function FaceoffLoader({ label, size = 56, className = '' }) {
  return (
    <div className={`${WRAP_CLASSES} ${className}`} role="status" aria-live="polite">
      <FaceoffRink frameAt={loaderFrame} showLetter={false} showRef={false} size={size} />
      {label && <div className={LABEL_CLASSES}>{label}</div>}
    </div>
  );
}
