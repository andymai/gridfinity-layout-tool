/** Loading placeholder rows shown while the saved-design list is being fetched. */
export function DesignListSkeleton() {
  return (
    <div className="space-y-2 py-2">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex animate-pulse motion-reduce:animate-none items-center gap-3 rounded-lg border border-stroke-subtle px-3 py-2.5"
        >
          <div className="h-10 w-10 flex-shrink-0 rounded-md bg-surface-elevated" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-24 rounded bg-surface-elevated" />
            <div className="h-3 w-16 rounded bg-surface-elevated" />
          </div>
        </div>
      ))}
    </div>
  );
}
