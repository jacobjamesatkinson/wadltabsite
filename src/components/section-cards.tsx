import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type StatCard = {
  label: string;
  value: string | number;
  hint?: string;
  badge?: string;
};

export function SectionCards({ cards }: { cards: StatCard[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      {cards.map((card) => (
        <Card key={card.label} className="@container/card">
          <CardHeader>
            <CardDescription>{card.label}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {card.value}
            </CardTitle>
            {card.badge ? (
              <CardAction>
                <Badge variant="outline">{card.badge}</Badge>
              </CardAction>
            ) : null}
          </CardHeader>
          {card.hint ? (
            <CardFooter className="text-sm text-muted-foreground">{card.hint}</CardFooter>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
