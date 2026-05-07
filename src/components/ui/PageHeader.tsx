import Link from "next/link";

import { Button } from "@/components/ui/button";

export function PageHeader(props: {
  title: string;
  description?: string;
  actions?: Array<{ label: string; href: string; variant?: "default" | "outline" }>;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="text-2xl font-semibold tracking-tight text-[color:var(--gov-text)]">
          {props.title}
        </div>
        {props.description ? <div className="mt-1 text-sm text-muted-foreground">{props.description}</div> : null}
      </div>
      {props.actions?.length ? (
        <div className="flex flex-wrap gap-2">
          {props.actions.map((a) => (
            <Button key={a.href} asChild size="sm" variant={a.variant ?? "outline"}>
              <Link href={a.href}>{a.label}</Link>
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

