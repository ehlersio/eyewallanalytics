// src/components/landing/LandingMedia.jsx
// One screenshot or clip from landingContent.js. Clips are muted, inline,
// lazy (preload="none") and only autoplay when motion is allowed.

import { useTranslation } from 'react-i18next';
import { prefersReducedMotion } from './useReveal';

export default function LandingMedia({ media, className = '' }) {
  const { t } = useTranslation();
  const alt = media.altKey ? t(media.altKey) : '';
  if (media.type === 'video') {
    const motion = !prefersReducedMotion();
    return (
      <video
        className={`block h-auto w-full ${className}`}
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
  return (
    <img
      className={`block h-auto w-full ${className}`}
      src={media.src}
      width={media.width}
      height={media.height}
      alt={alt}
      loading="lazy"
      decoding="async"
    />
  );
}
