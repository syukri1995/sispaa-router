export function StatCard(props: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border bg-white/70 p-4 shadow-md backdrop-blur">
      <div className="text-sm text-muted-foreground">{props.label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{props.value}</div>
      {props.hint ? <div className="mt-1 text-xs text-muted-foreground">{props.hint}</div> : null}
    </div>
  );
}

