import { CARD_TYPES, CardType } from "@tearframe/shared";
import { GenericCard } from "./cards/GenericCard";

export function CardTabs({ cards }: { cards: Partial<Record<CardType, unknown>> }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {CARD_TYPES.map((type: CardType) => (
        <GenericCard key={type} type={type} payload={cards[type]} />
      ))}
    </div>
  );
}
