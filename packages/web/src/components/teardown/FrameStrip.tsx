export function FrameStrip({ frames }: { frames: Array<{ path: string; timestamp_sec: number }> }) {
  return (
    <div className="grid grid-cols-4 gap-2 md:grid-cols-8">
      {frames.map((frame) => (
        <img key={frame.path} src={frame.path} alt={`${frame.timestamp_sec}s`} className="aspect-video rounded-lg bg-zinc-200 object-cover dark:bg-zinc-800" />
      ))}
    </div>
  );
}
