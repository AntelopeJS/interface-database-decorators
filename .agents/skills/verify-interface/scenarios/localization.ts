import type { Journey } from "@antelopejs/tooling-configs/verify";

import { scenario } from "../runner.ts";

const PRODUCT = `
  class Product extends d.Table.with(d.LocalizationModifier) {}
  decorate(Product, {
    price: [d.Field("number")],
    name: [d.Localized({ fallbackLocale: "en" }), d.Field("string")],
    description: [d.Localized({ fallbackLocale: "en" }), d.Field("string")],
    bare: [d.Localized(), d.Field("string")],
    summary: [d.Localized({ fallbackLocale: "en" }), d.Field("string")],
  });
  d.RegisterTable("products", "loc")(Product);
  await d.RegisterSchema("loc");
`;

const LOCALIZE = `${PRODUCT}
  const product = new Product();
  product._id = "prod-123";
  product.price = 99.99;
  product.localize("en").name = "Premium Headphones";
  product.localize("fr").name = "Casque Premium";
  product.localize("es").name = "Auriculares Premium";
  const spanish = product.localize("es");
  const spanishNow = spanish.name;
  const german = product.localize("de");
  const germanNow = german.name;
  const sameObject = [spanish === product, german === product, spanish === german];
  const readNow = spanish.name;
  product.localize("en").description = "Loud";
  product.localize("fr").description = "";
  const frenchEmpty = product.localize("fr").description;
  product.localize("fr").bare = "sans repli";
  const noFallback = [product.localize("fr").bare, product.localize("de").bare ?? "undefined"];
  product.localize("en").summary = "short";
  product.localize("fr").summary = "court";
  const restricted = product.localize("en").localize("fr", ["name"]);
  const restrictedReads = [restricted.name, restricted.summary];
  return {
    spanish: spanishNow,
    germanFallsBack: germanNow,
    sameObject,
    readNow,
    frenchEmpty,
    noFallback,
    restrictedReads,
    fallbackLocaleOf: [d.LocalizationModifier.fallbackLocaleOf(Product, "name"), d.LocalizationModifier.fallbackLocaleOf(Product, "bare") ?? "undefined", d.LocalizationModifier.fallbackLocaleOf(Product, "price") ?? "undefined", d.LocalizationModifier.fallbackLocaleOf(Product, "missing") ?? "undefined"],
  };
`;

const WILDCARD = `${PRODUCT}
  const product = new Product();
  product.localize("en").name = "Premium Headphones";
  product.localize("fr").name = "Casque Premium";
  const all = product.localize("*").name;
  Object.assign(product.localize("*"), { name: { en: "Premium Headphones", fr: "Casque Premium", de: "Premium-Kopfhoerer", es: "" } });
  const replaced = product.localize("*").name;
  const german = product.localize("de").name;
  const model = d.GetModel(d.BasicDataModel(Product));
  const written = new Product();
  written.localize("en").name = "Hello";
  written.localize("fr").name = "Bonjour";
  const [id] = await model.insert(written);
  const loaded = await model.get(id);
  return { all, replaced, german, stored: [loaded.localize("fr").name, loaded.localize("it").name, loaded.localize("*").name] };
`;

const STORED = `${PRODUCT}
  const model = d.GetModel(d.BasicDataModel(Product));
  const first = new Product();
  first.price = 5;
  first.localize("en").name = "Hello";
  first.localize("fr").name = "Bonjour";
  first.localize("de").name = "";
  const [id] = await model.insert(first);
  const alone = new Product();
  alone.price = 6;
  alone.localize("fr").name = "Seulement";
  const [second] = await model.insert(alone);
  const only = await model.get(second);
  const raw = await rawTable("loc", "products").get(id);
  return { rawKeys: Object.keys(raw._internal.data).sort(), raw: raw._internal.data.name, onlyFrench: [only.localize("fr").name, only.localize("en").name ?? "undefined"] };
`;

const AUTO = `
  class Article extends d.Table {}
  decorate(Article, { title: [d.Field("string")], creationDate: [d.CreationTime(), d.Field("date")], updateDate: [d.UpdateTime(), d.Field("date")] });
  d.RegisterTable("articles", "auto")(Article);
  await d.RegisterSchema("auto");
  const model = d.GetModel(d.BasicDataModel(Article));
  const before = Date.now();
  const [id] = await model.insert({ title: "One", creationDate: new Date(0), updateDate: new Date(0) });
  const inserted = await rawTable("auto", "articles").get(id);
  await sleep(60);
  await model.update(id, { title: "Two", creationDate: new Date(0) });
  const updated = await rawTable("auto", "articles").get(id);
  const after = Date.now();
  const stamp = (value) => new Date(value).getTime();
  return {
    insertSetsBoth: [stamp(inserted.creationDate) >= before, stamp(inserted.updateDate) >= before, stamp(inserted.creationDate) <= after],
    creationKeptOnUpdate: stamp(updated.creationDate) === stamp(inserted.creationDate),
    updateRefreshed: stamp(updated.updateDate) >= stamp(inserted.updateDate) + 50,
    noMixinNeeded: Object.getPrototypeOf(Article.prototype) === d.Table.prototype,
  };
`;

export const LOCALIZATION_JOURNEYS = {
  localize: scenario({ title: "localize switches the locale of an instance and falls back when a translation is missing or empty", body: LOCALIZE, printed: "{\"spanish\":\"Auriculares Premium\",\"germanFallsBack\":\"Premium Headphones\",\"sameObject\":[true,true,true],\"readNow\":\"Premium Headphones\",\"frenchEmpty\":\"Loud\",\"noFallback\":[\"sans repli\",\"undefined\"],\"restrictedReads\":[\"Casque Premium\",\"short\"],\"fallbackLocaleOf\":[\"en\",\"undefined\",\"undefined\",\"undefined\"]}" }),
  "localize-wildcard": scenario({ title: "the wildcard key reads and writes every translation at once", body: WILDCARD, printed: "{\"all\":{\"en\":\"Premium Headphones\",\"fr\":\"Casque Premium\"},\"replaced\":{\"en\":\"Premium Headphones\",\"fr\":\"Casque Premium\",\"de\":\"Premium-Kopfhoerer\"},\"german\":\"Premium-Kopfhoerer\",\"stored\":[\"Bonjour\",\"Hello\",{\"en\":\"Hello\",\"fr\":\"Bonjour\"}]}" }),
  "localized-storage": scenario({
    title: "a localized field is stored as one value per locale",
    body: STORED,
    printed: "{\"rawKeys\":[\"name\"],\"raw\":{\"en\":\"Hello\",\"fr\":\"Bonjour\"},\"onlyFrench\":[\"Seulement\",\"undefined\"]}",
    stored: [{ name: "the stored translations", expression: "$DB.getCollection('loc__products').find().sort({ price: 1 }).toArray().map((r) => r._internal.data.name)", expected: "[{\"en\":\"Hello\",\"fr\":\"Bonjour\"},{\"fr\":\"Seulement\"}]" }],
  }),
} satisfies { [id: string]: Journey };

export const AUTODATE_JOURNEYS = {
  autodate: scenario({
    title: "CreationTime is set on insert and kept on update, UpdateTime is set on insert and refreshed on update",
    body: AUTO,
    printed: "{\"insertSetsBoth\":[true,true,true],\"creationKeptOnUpdate\":true,\"updateRefreshed\":true,\"noMixinNeeded\":true}",
    stored: [{ name: "the article dates", expression: "$DB.getCollection('auto__articles').find().toArray().map((r) => [r.title, r.creationDate instanceof Date, r.updateDate > r.creationDate])", expected: "[[\"Two\",true,true]]" }],
  }),
} satisfies { [id: string]: Journey };
