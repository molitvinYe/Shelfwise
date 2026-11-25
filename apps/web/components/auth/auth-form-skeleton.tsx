export function AuthFormSkeleton({ fields }: { fields: number }) {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <div className="h-4 w-16 animate-pulse rounded bg-border/60" />
          <div className="h-10 animate-pulse rounded-lg bg-border/40" />
        </div>
      ))}
      <div className="h-9 animate-pulse rounded-lg bg-border/60" />
    </div>
  );
}
