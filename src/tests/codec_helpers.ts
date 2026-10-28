import type { FieldType } from "@antelopejs/interface-database/schema";

export type DecodeLeft = {
  _tag: "Left";
  left: Array<{ value: unknown; context: unknown[]; message?: string }>;
};
export type DecodeRight<T> = { _tag: "Right"; right: T };
export type DecodeResult<T> = DecodeLeft | DecodeRight<T>;

type FieldCodec = Extract<FieldType, { decode: unknown }>;

export type TestCodec<T> = {
  readonly _A: T;
  readonly _O: T;
  readonly _I: unknown;
  readonly name: string;
  is(u: unknown): u is T;
  encode(a: T): ReturnType<FieldCodec["encode"]>;
  decode(u: Parameters<FieldCodec["decode"]>[0]): DecodeResult<T>;
};

export function makeCodec<T>(
  name: string,
  guard: (u: unknown) => u is T,
): TestCodec<T> {
  return {
    _A: undefined as unknown as T,
    _O: undefined as unknown as T,
    _I: undefined,
    name,
    is: guard,
    encode: (a) => a,
    decode: (u) =>
      guard(u)
        ? { _tag: "Right", right: u }
        : {
            _tag: "Left",
            left: [{ value: u, context: [], message: `not ${name}` }],
          },
  };
}

export const stringCodec: TestCodec<string> = makeCodec(
  "string",
  (u): u is string => typeof u === "string",
);
export const numberCodec: TestCodec<number> = makeCodec(
  "number",
  (u): u is number => typeof u === "number",
);

export function asFieldType(codec: TestCodec<unknown>): FieldType {
  return codec;
}
