import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { StyleDNAView } from "../components/author/StyleDNAView";
import { ErrorState } from "../components/shared/ErrorState";
import { getAuthorProfile } from "../lib/api";

export function AuthorPage() {
  const { handle } = useParams();
  const authorHandle = handle ?? "";
  const profile = useQuery({ queryKey: ["author", authorHandle], queryFn: () => getAuthorProfile(authorHandle), enabled: Boolean(authorHandle) });

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-6 lg:px-6">
      <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm font-medium text-zinc-500">作者档案</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">从历史样片反推出风格 DNA。</h1>
      </div>
      <div className="mt-4">
        {profile.isError ? <ErrorState message={profile.error.message} /> : null}
        {profile.data ? <StyleDNAView profile={profile.data} /> : null}
      </div>
    </main>
  );
}
