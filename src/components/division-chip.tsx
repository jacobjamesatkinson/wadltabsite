import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Pick black/white label text for readable contrast on a hex background. */
export function chipLabelColor(hex: string | null | undefined): string {
  if (!hex) return "";
  const raw = hex.replace("#", "").trim();
  if (raw.length !== 3 && raw.length !== 6) return "#fff";
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return "#fff";
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#111827" : "#ffffff";
}

export function DivisionChip({
  name,
  color,
  className,
}: {
  name: string;
  color?: string | null;
  className?: string;
}) {
  if (!name || name === "—") {
    return <span className="text-muted-foreground">—</span>;
  }
  if (!color) {
    return (
      <Badge variant="secondary" className={cn("font-medium", className)}>
        {name}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className={cn("border-transparent font-medium", className)}
      style={{
        backgroundColor: color,
        color: chipLabelColor(color),
      }}
    >
      {name}
    </Badge>
  );
}
