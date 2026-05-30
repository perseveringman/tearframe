import type { AuthorProfile } from "../../lib/api";

export function StyleDNAView({ profile }: { profile: AuthorProfile }) {
  const hookEntries = Object.entries(profile.profile.hook_patterns);
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">{profile.display_name ?? profile.author_handle}</h2>
          <p className="mt-1 text-sm text-zinc-500">{profile.sample_count} 条样片参与聚合</p>
        </div>
        <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">{profile.profile.pace_fingerprint}</span>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg bg-zinc-100 p-4 dark:bg-zinc-900">
          <h3 className="text-sm font-semibold">选题偏好</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.profile.topic_bias.length > 0 ? profile.profile.topic_bias.map((item) => <span key={item} className="rounded-md bg-white px-2 py-1 text-xs text-zinc-600 dark:bg-zinc-950 dark:text-zinc-300">{item}</span>) : <span className="text-sm text-zinc-500">insufficient-data</span>}
          </div>
        </section>
        <section className="rounded-lg bg-zinc-100 p-4 dark:bg-zinc-900">
          <h3 className="text-sm font-semibold">钩子模式</h3>
          <div className="mt-3 space-y-2">
            {hookEntries.length > 0 ? hookEntries.map(([key, count]) => (
              <div key={key} className="flex items-center justify-between text-sm">
                <span>{key}</span>
                <span className="font-medium">{count}</span>
              </div>
            )) : <span className="text-sm text-zinc-500">insufficient-data</span>}
          </div>
        </section>
        <section className="rounded-lg bg-zinc-100 p-4 dark:bg-zinc-900">
          <h3 className="text-sm font-semibold">节奏指纹</h3>
          <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{profile.profile.pace_fingerprint}</p>
        </section>
      </div>
    </div>
  );
}
