import { type KeyboardEvent } from "react";
import { Clapperboard, ImageOff, PlayCircle } from "lucide-react";
import { mediaUrl, type StoryboardBeat } from "../../lib/api";
import { seekInsideSegment } from "../../lib/seek";
import { usePlayerStore } from "../../stores/playerStore";

export type FrameData = { path: string; timestamp_sec: number; shot_index?: number };
export type ShotData = { index: number; start_sec: number; end_sec: number; frame_path?: string };

type ShotAnalysisRow = {
  shot_index: number;
  start_sec: number;
  end_sec: number;
  frame_path?: string;
  beat?: StoryboardBeat;
};

type ShotAnalysisTableProps = {
  beats: StoryboardBeat[];
  shots: ShotData[];
  frames: FrameData[];
  resolution?: string | null;
  currentTime: number;
  fill?: boolean;
  dense?: boolean;
};

export function ShotAnalysisTable({ beats, shots, frames, resolution, currentTime, fill = false, dense = false }: ShotAnalysisTableProps) {
  const rows = buildShotRows(beats, shots);
  const frameByShot = new Map(frames.filter((frame): frame is FrameData & { shot_index: number } => typeof frame.shot_index === "number").map((frame) => [frame.shot_index, frame.path]));
  const mediaShape = getMediaShape(resolution);
  const seekTo = usePlayerStore((state) => state.seekTo);
  const interpretedCount = rows.filter((row) => row.beat).length;
  return (
    <section className={classNames("overflow-hidden border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950", fill ? "flex h-full min-h-0 flex-col rounded-none" : "rounded-lg")}>
      <div className={classNames("flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800", dense ? "px-3 py-2.5" : "p-4")}>
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-zinc-950 dark:text-zinc-50">
            <Clapperboard className="size-4" />
            逐 shot 详细解读
          </h2>
          <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">点击任意一行，视频会从该 shot 的起点播放。表格按镜头切分覆盖，缺失项会直接暴露给 agent 补齐。</p>
        </div>
        <span className="rounded-lg bg-zinc-100 px-2.5 py-1.5 font-mono text-xs font-semibold text-zinc-600 tabular-nums dark:bg-zinc-900 dark:text-zinc-300">
          {interpretedCount}/{rows.length} interpreted
        </span>
      </div>
      <div className={fill ? "min-h-0 flex-1 overflow-auto" : "overflow-x-auto"}>
        <table className={classNames("table-fixed border-separate border-spacing-0 text-left", dense ? "min-w-[1180px]" : "min-w-[1280px]")}>
          <colgroup>
            <col className={dense ? "w-28" : "w-32"} />
            <col className={dense ? "w-28" : "w-32"} />
            <col className="w-24" />
            <col className="w-20" />
            <col className={dense ? "w-56" : "w-64"} />
            <col className={dense ? "w-48" : "w-52"} />
            <col className={dense ? "w-44" : "w-48"} />
            <col className="w-40" />
            <col className={dense ? "w-56" : "w-64"} />
          </colgroup>
          <thead>
            <tr>
              {["关键帧", "Shot / 时间", "景别", "时长", "画面内容", "旁白", "背景音", "摄像机角度", "构图解读"].map((label) => (
                <th key={label} className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const beat = row.beat;
              const framePath = beat?.frame_path ?? row.frame_path;
              const frameSrc = frameByShot.get(row.shot_index) ?? (framePath ? mediaUrl(framePath) ?? framePath : undefined);
              const active = currentTime >= row.start_sec && currentTime < row.end_sec;
              const rowKey = beat?.id ?? `${row.shot_index}-${row.start_sec}-${row.end_sec}`;
              const jump = () => seekTo?.(seekInsideSegment(row.start_sec, row.end_sec));
              const onKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  jump();
                }
              };
              const voiceover = beat?.voiceover || beat?.transcript_excerpt;
              const backgroundAudio = beat?.background_audio || beat?.audio_note;
              const camera = beat?.camera_angle || beat?.camera_motion;
              const composition = beat?.composition_analysis || beat?.composition;
              return (
                <tr
                  key={rowKey}
                  tabIndex={0}
                  role="button"
                  aria-label={`从 ${formatSeconds(row.start_sec)} 播放 Shot ${row.shot_index}`}
                  onClick={jump}
                  onKeyDown={onKeyDown}
                  className={`group cursor-pointer outline-none transition hover:bg-zinc-50 focus:bg-zinc-50 dark:hover:bg-zinc-900/70 dark:focus:bg-zinc-900/70 ${
                    active ? "bg-cyan-50/80 dark:bg-cyan-950/30" : "bg-white dark:bg-zinc-950"
                  }`}
                >
                  <td className={classNames("border-b border-zinc-100 px-3 align-top dark:border-zinc-900", dense ? "py-2" : "py-3")}>
                    <div className={`relative overflow-hidden rounded-md bg-zinc-200 dark:bg-zinc-800 ${shotFrameClass(mediaShape, dense)}`}>
                      {frameSrc ? (
                        <img src={frameSrc} alt={`Shot ${row.shot_index} ${formatRange(row.start_sec, row.end_sec)} 关键帧`} className="h-full w-full object-cover transition group-hover:scale-[1.03]" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-zinc-500">
                          <ImageOff className="size-6" />
                        </div>
                      )}
                      {active ? <div className="absolute inset-x-0 bottom-0 h-1 bg-cyan-500" /> : null}
                    </div>
                  </td>
                  <td className={classNames("border-b border-zinc-100 px-3 align-top dark:border-zinc-900", dense ? "py-2" : "py-3")}>
                    <div className="flex items-center gap-2 font-semibold text-zinc-950 dark:text-zinc-50">
                      <PlayCircle className={`size-4 ${active ? "text-cyan-600 dark:text-cyan-300" : "text-zinc-400"}`} />
                      Shot {row.shot_index}
                    </div>
                    <div className="mt-1 font-mono text-xs text-zinc-500 tabular-nums">{formatRange(row.start_sec, row.end_sec)}</div>
                  </td>
                  <ShotCell value={beat?.shot_size} dense={dense} />
                  <td className={classNames("border-b border-zinc-100 px-3 align-top font-mono text-xs text-zinc-600 tabular-nums dark:border-zinc-900 dark:text-zinc-400", dense ? "py-2" : "py-3")}>{formatDuration(row.end_sec - row.start_sec)}</td>
                  <ShotCell value={beat?.visual_summary} strong fallback="等待画面解读" dense={dense} />
                  <ShotCell value={voiceover} fallback="无旁白/未提交" dense={dense} />
                  <ShotCell value={backgroundAudio} fallback="未提交" dense={dense} />
                  <ShotCell value={camera} fallback="未提交" dense={dense} />
                  <ShotCell value={composition} fallback="未提交" dense={dense} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function buildShotRows(beats: StoryboardBeat[], shots: ShotData[]): ShotAnalysisRow[] {
  const beatByShot = new Map<number, StoryboardBeat>();
  for (const beat of beats) {
    if (!beatByShot.has(beat.shot_index)) beatByShot.set(beat.shot_index, beat);
  }

  if (shots.length === 0) {
    return beats
      .map((beat) => ({
        shot_index: beat.shot_index,
        start_sec: beat.start_sec,
        end_sec: beat.end_sec,
        frame_path: beat.frame_path,
        beat
      }))
      .sort((a, b) => a.start_sec - b.start_sec || a.shot_index - b.shot_index);
  }

  const shotIndexes = new Set(shots.map((shot) => shot.index));
  const rows = shots.map((shot) => ({
    shot_index: shot.index,
    start_sec: shot.start_sec,
    end_sec: shot.end_sec,
    frame_path: shot.frame_path,
    beat: beatByShot.get(shot.index)
  }));
  const extraBeats = beats
    .filter((beat) => !shotIndexes.has(beat.shot_index))
    .map((beat) => ({
      shot_index: beat.shot_index,
      start_sec: beat.start_sec,
      end_sec: beat.end_sec,
      frame_path: beat.frame_path,
      beat
    }));

  return [...rows, ...extraBeats].sort((a, b) => a.start_sec - b.start_sec || a.shot_index - b.shot_index);
}

function ShotCell({ value, fallback = "--", strong = false, dense = false }: { value?: string; fallback?: string; strong?: boolean; dense?: boolean }) {
  const content = value?.trim();
  return (
    <td className={classNames("border-b border-zinc-100 px-3 align-top text-xs leading-5 dark:border-zinc-900", dense ? "py-2" : "py-3", strong ? "font-medium text-zinc-800 dark:text-zinc-100" : "text-zinc-600 dark:text-zinc-400")}>
      {content ? <span className={dense ? "line-clamp-3" : "line-clamp-4"}>{content}</span> : <span className="text-zinc-400 dark:text-zinc-600">{fallback}</span>}
    </td>
  );
}

function shotFrameClass(shape: MediaShape, dense: boolean) {
  if (shape === "portrait") return dense ? "mx-auto h-20 w-12" : "mx-auto h-24 w-14";
  if (shape === "square") return dense ? "h-16 w-16" : "h-20 w-20";
  return dense ? "h-14 w-24" : "h-16 w-28";
}

function formatRange(start: number, end: number) {
  return `${formatSeconds(start)} - ${formatSeconds(end)}`;
}

function formatSeconds(value: number) {
  const fixed = Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  return `${fixed}s`;
}

function formatDuration(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "--";
  return `${Math.round(value * 10) / 10}s`;
}

type MediaShape = "landscape" | "portrait" | "square" | "unknown";

function getMediaShape(resolution?: string | null): MediaShape {
  const match = resolution?.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
  if (!match) return "unknown";
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return "unknown";
  const ratio = width / height;
  if (ratio > 1.08) return "landscape";
  if (ratio < 0.92) return "portrait";
  return "square";
}

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
