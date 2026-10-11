import { useEffect, useRef, useState } from "react";

/**
 * HOW TO ADD YOUR VIDEO
 * ---------------------
 * Drop your file at:  public/videos/hero-characters.mp4
 * (or change VIDEO_SRC below). Nothing else needs to change.
 *
 * Until the file exists (or if it fails to load) a clean cream placeholder is
 * shown, so there is never a broken-video icon. The video is muted, looped,
 * inline and has no audio. If the visitor prefers reduced motion, it does not
 * autoplay: the first frame is shown with a play control instead.
 *
 * Tip: if your video has a cream background, match it to #F7F1E8 so it blends
 * seamlessly into the page. Change ASPECT_RATIO if your video isn't 16:9.
 */
const VIDEO_SRC = "/videos/hero-characters.mp4";
const ASPECT_RATIO = "16 / 9";

export default function HeroCharacterVideo() {
  const videoRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    setReduceMotion(mq.matches);
    const onChange = (e) => setReduceMotion(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // Browsers may refuse autoplay; fail silently and leave the first frame.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (reduceMotion) {
      v.pause();
    } else if (ready) {
      v.play().catch(() => {});
    }
  }, [ready, reduceMotion]);

  return (
    <div className="lp-video" style={{ aspectRatio: ASPECT_RATIO }}>
      {!failed && (
        <video
          ref={videoRef}
          className={"lp-video__el" + (ready ? " is-ready" : "")}
          src={VIDEO_SRC}
          muted
          loop
          playsInline
          autoPlay={!reduceMotion}
          controls={reduceMotion && ready}
          preload="metadata"
          aria-label="Animated video of the companion characters"
          onLoadedData={() => setReady(true)}
          onError={() => setFailed(true)}
        />
      )}
      {!ready && (
        <div className="lp-video__placeholder" role="img" aria-label="Character video coming soon">
          {/* Placeholder only. Add your video at public/videos/hero-characters.mp4 */}
        </div>
      )}
    </div>
  );
}
