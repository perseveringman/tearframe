import { zodToJsonSchema } from "zod-to-json-schema";
import { CardType } from "../constants/cards";
import { CardSchemas } from "./cards";

export * from "./common";
export * from "./cards";

export function getCardSchema(cardType: CardType) {
  return CardSchemas[cardType];
}

export function getCardJsonSchema(cardType: CardType) {
  return zodToJsonSchema(CardSchemas[cardType], `${cardType}Card`);
}
