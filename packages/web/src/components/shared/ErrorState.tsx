export function ErrorState({ message }: { message: string }) {
  return <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">{message}</div>;
}
