import { useRef } from 'react';

const CLIP_SECONDS = 15;

// Audio player capped at 15 seconds — short extracts keep the game snappy.
export default function AudioClip({ src, autoPlay = false, className = '' }) {
  const ref = useRef(null);
  const stopAtCap = () => {
    const a = ref.current;
    if (a && a.currentTime >= CLIP_SECONDS) a.pause();
  };
  return (
    <audio
      ref={ref}
      controls
      autoPlay={autoPlay}
      preload="auto"
      src={src}
      onTimeUpdate={stopAtCap}
      className={className}
    />
  );
}
