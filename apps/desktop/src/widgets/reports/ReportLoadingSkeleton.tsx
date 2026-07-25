export function ReportLoadingSkeleton() {
  return (
    <div className="space-y-3 p-6 text-sm text-muted-foreground">
      {Array.from({ length: 12 }).map((_, index) => (
        <div key={index} className="h-6 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}
