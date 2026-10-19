// src/components/landing/LandingMedia.jsx
// One screenshot or clip from landingContent.js. A screenshot with a light
// capture renders both <img>s and index.css's .landing-shot-dark/-light
// show the one for the active theme ([data-theme], so the app's own theme
// choice wins over the OS). Clips are muted, inline, lazy (preload="none")
// and only autoplay when motion is allowed; Phones (FeatureMedia.jsx) swaps
// a clip for its stills under prefers-reduced-motion.

import { useTranslation } from 'react-i18next';
import { prefersReducedMotion } from './useReveal';

// React sets `muted` as a property only; Safari checks the attribute's
// default (defaultMuted) before it lets a clip autoplay inline.
function keepMuted(video) {
  if (video) {
    video.defaultMuted = true;
    video.muted = true;
  }
}

export default function LandingMedia({ media, className = '' }) {
  const { t } = useTranslation();
  const alt = media.altKey ? t(media.altKey) : '';
  if (media.type === 'video') {
    const motion = !prefersReducedMotion();
    return (
      <video
        ref={keepMuted}
        className={`landing-clip block h-auto w-full ${className}`}
        src={media.src}
        poster={media.poster}
        width={media.width}
        height={media.height}
        aria-label={alt}
        muted
        playsInline
        loop={motion}
        autoPlay={motion}
        controls={!motion}
        preload="none"
      />
    );
  }
  const img = (src, themeClass) => (
    <img
      key={src}
      className={`${themeClass} h-auto w-full ${className}`}
      src={src}
      width={media.width}
      height={media.height}
      alt={alt}
      loading="lazy"
      decoding="async"
    />
  );
  if (!media.srcLight) return img(media.src, 'block');
  return (
    <>
      {img(media.src, 'landing-shot-dark')}
      {img(media.srcLight, 'landing-shot-light')}
    </>
  );
}
