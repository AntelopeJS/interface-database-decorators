import type { Journey } from "@antelopejs/tooling-configs/verify";

import { scenario } from "../runner.ts";

const KEY = "12345678901234567890123456789012";

const TWO_WAY = `
  class Vault extends d.Table.with(d.EncryptionModifier, d.LocalizationModifier) {}
  decorate(Vault, {
    secret: [d.Encrypted({ secretKey: "${KEY}" }), d.Field("string")],
    title: [d.Localized({ fallbackLocale: "en" }), d.Field("string")],
  });
  d.RegisterTable("vaults", "tv")(Vault);
  await d.RegisterSchema("tv");
  const model = d.GetModel(d.BasicDataModel(Vault));
  const draft = new Vault();
  draft.secret = "right";
  draft.localize("en").title = "Hello";
  draft.localize("fr").title = "Bonjour";
  const [id] = await model.insert(draft);
  const loaded = await model.get(id);
  const french = loaded.localize("fr");
  const frenchTests = [d.testValue(french, "title", "Bonjour"), d.testValue(french, "title", "Hello")];
  const fresh = await model.get(id);
  return {
    encrypted: [d.testValue(loaded, "secret", "right"), d.testValue(loaded, "secret", "wrong")],
    localized: frenchTests,
    unselectedLocale: d.testValue(fresh, "title", "Hello"),
  };
`;

export const TEST_VALUE_JOURNEYS = {
  "test-value-two-way": scenario({
    title: "testValue answers true for the right value and false for a wrong one on an encrypted and on a localized field",
    body: TWO_WAY,
    printed: "{\"encrypted\":[true,false],\"localized\":[true,false],\"unselectedLocale\":false}",
  }),
} satisfies { [id: string]: Journey };
