export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-zinc-950">
      <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">{title}</h2>
      {body ? <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{body}</p> : null}
    </div>
  );
}
