import { CardType, getCardSchema } from "@tearframe/shared";
import { ZodError } from "zod";

export class CardValidationError extends Error {
  constructor(readonly cardType: CardType, readonly issues: ZodError["issues"]) {
    super(`Invalid ${cardType} card: ${issues.map((issue) => issue.path.join(".") || issue.message).join(", ")}`);
  }
}

export class CardValidator {
  validate(cardType: CardType, payload: unknown) {
    const result = getCardSchema(cardType).safeParse(payload);
    if (!result.success) {
      throw new CardValidationError(cardType, result.error.issues);
    }
    return result.data;
  }
}
