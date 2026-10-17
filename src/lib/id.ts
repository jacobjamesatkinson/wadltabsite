import { nanoid } from "nanoid";

const DEFAULT_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

interface GenerateIdOptions {
  alphabet?: string;
  length?: number;
};

/** Dice UI / data-table random id helper. */
export function generateId(
  prefixOrOptions?: string | GenerateIdOptions,
  inputOptions: GenerateIdOptions = {}
): string {
  const options =
    typeof prefixOrOptions === "object" ? prefixOrOptions : inputOptions;
  const { alphabet = DEFAULT_ALPHABET, length = 12 } = options;
  const id = Array.from(
    { length },
    () => alphabet[(Math.random() * alphabet.length) | 0]
  ).join("");
  return typeof prefixOrOptions === "string" ? `${prefixOrOptions}_${id}` : id;
}

/** App entity ids (prefixed nanoid). */
export function createId(prefix?: string) {
  const id = nanoid(16);
  return prefix ? `${prefix}_${id}` : id;
}
