import { useEffect, useRef } from "react";
import { twMerge } from "tailwind-merge";
import { usePlayerStore } from "../../stores/playerStore";

export function VideoPlayer({ src, className }: { src?: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const setSeekTo = usePlayerStore((state) => state.setSeekTo);
  const setCurrentTime = usePlayerStore((state) => state.setCurrentTime);

  useEffect(() => {
    setSeekTo((seconds) => {
      if (ref.current) ref.current.currentTime = seconds;
    });
  }, [setSeekTo]);

  return (
    <video
      ref={ref}
      src={src}
      controls
      onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
      className={twMerge("h-auto max-h-[46dvh] w-full rounded-lg bg-zinc-900 object-contain", className)}
    />
  );
}
