// src/components/landing/PhoneFrame.jsx
// A phone drawn in CSS around a screenshot: rounded rectangle, thin dark
// bezel, no notch art and no device photo.

const FRAME_CLASSES = 'landing-phone relative rounded-[34px] bg-[#05080e] p-[6px] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.08)]';
const SCREEN_CLASSES = 'overflow-hidden rounded-[28px] bg-[var(--bg1)]';

export default function PhoneFrame({ children, className = '' }) {
  return (
    <div className={`${FRAME_CLASSES} ${className}`}>
      <div className={SCREEN_CLASSES}>{children}</div>
    </div>
  );
}
