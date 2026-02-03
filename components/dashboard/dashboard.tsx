export function Dashboard({ home }: { home: any }) {
  return (
    <div className="flex flex-1 flex-col gap-8 p-8 max-w-6xl mx-auto w-full">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">
          Welcome to{" "}
          <span className="font-semibold text-foreground">{home.name}</span>
        </p>
      </div>

      <div className="grid auto-rows-min gap-6 md:grid-cols-3">
        <div className="aspect-video rounded-xl bg-zinc-100/50 dark:bg-zinc-800/50 shadow-sm border border-zinc-200/50 dark:border-zinc-700/50" />
        <div className="aspect-video rounded-xl bg-zinc-100/50 dark:bg-zinc-800/50 shadow-sm border border-zinc-200/50 dark:border-zinc-700/50" />
        <div className="aspect-video rounded-xl bg-zinc-100/50 dark:bg-zinc-800/50 shadow-sm border border-zinc-200/50 dark:border-zinc-700/50" />
      </div>

      <div className="flex-1 rounded-xl bg-zinc-100/50 dark:bg-zinc-800/50 shadow-sm border border-zinc-200/50 dark:border-zinc-700/50 min-h-[300px]" />
    </div>
  );
}
