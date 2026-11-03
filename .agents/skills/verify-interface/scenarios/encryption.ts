import type { Journey } from "@antelopejs/tooling-configs/verify";

import { scenario } from "../runner.ts";

const KEY = "12345678901234567890123456789012";

/** Decrypts a stored `[ciphertext, iv, authTag]` triple with Node's crypto alone: the scenario's second view of the cipher. */
const DECRYPT = `
  const decrypt = (triple, algorithm = "aes-256-gcm", key = "${KEY}") => {
    const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(triple[1], "base64"));
    if (triple[2]) decipher.setAuthTag(Buffer.from(triple[2], "base64"));
    return Buffer.concat([decipher.update(Buffer.from(triple[0], "base64")), decipher.final()]).toString("utf8");
  };
`;

const AT_REST = `${DECRYPT}
  class Vault extends d.Table.with(d.EncryptionModifier) {}
  decorate(Vault, {
    owner: [d.Field("string")],
    card: [d.Encrypted({ secretKey: "${KEY}", algorithm: "aes-256-gcm", ivSize: 16 }), d.Field("string")],
    personal: [d.Encrypted({ secretKey: "${KEY}" }), d.Field("any")],
    legacy: [d.Encrypted({ secretKey: "${KEY}", algorithm: "aes-256-cbc" }), d.Field("string")],
    short: [d.Encrypted({ secretKey: "${KEY}", ivSize: 12 }), d.Field("string")],
  });
  d.RegisterTable("vaults", "enc")(Vault);
  await d.RegisterSchema("enc");
  const model = d.GetModel(d.BasicDataModel(Vault));
  const personal = { ssn: "078-05-1120", birthDate: "1990-01-01" };
  const [id] = await model.insert({ owner: "Ann", card: "4242 4242 4242 4242", personal, legacy: "old cipher", short: "twelve" });
  const [again] = await model.insert({ owner: "Bea", card: "4242 4242 4242 4242" });
  const read = await model.get(id);
  const raw = await rawTable("enc", "vaults").get(id);
  const rawAgain = await rawTable("enc", "vaults").get(again);
  const data = raw._internal.data;
  const shape = (triple) => [Array.isArray(triple), triple.length, typeof triple[2]];
  return {
    read: [read.card, read.personal, read.legacy, read.short],
    topLevelHoldsNoCiphertext: raw.card === undefined && raw.personal === undefined,
    gcmShape: shape(data.card),
    cbcShape: [data.legacy.length, data.legacy[2] ?? null],
    ivBytes: [Buffer.from(data.card[1], "base64").length, Buffer.from(data.short[1], "base64").length],
    plaintextAbsent: !JSON.stringify(raw).includes("4242") && !JSON.stringify(raw).includes("078-05-1120"),
    independentDecrypt: [decrypt(data.card), decrypt(data.personal), decrypt(data.legacy, "aes-256-cbc")],
    sameValueTwice: [data.card[1] !== rawAgain._internal.data.card[1], data.card[0] !== rawAgain._internal.data.card[0]],
  };
`;

const DATES = `${DECRYPT}
  class Event extends d.Table.with(d.EncryptionModifier) {}
  decorate(Event, { when: [d.Encrypted({ secretKey: "${KEY}" }), d.Field("any")], plainObject: [d.Encrypted({ secretKey: "${KEY}" }), d.Field("any")] });
  d.RegisterTable("events", "encdate")(Event);
  await d.RegisterSchema("encdate");
  const model = d.GetModel(d.BasicDataModel(Event));
  const moment = new Date("2026-01-02T03:04:05.678Z");
  const [id] = await model.insert({ when: moment, plainObject: { type: "Date", value: "not a date", extra: 1 } });
  const read = await model.get(id);
  const raw = await rawTable("encdate", "events").get(id);
  return {
    isDate: read.when instanceof Date,
    iso: read.when.toISOString(),
    storedText: JSON.parse(decrypt(raw._internal.data.when)),
    lookalikeKept: read.plainObject,
  };
`;

const KEYS = `
  class Strict extends d.Table.with(d.EncryptionModifier) {}
  const goodKey = "${KEY}";
  const hexKey = Buffer.from(goodKey).toString("hex");
  class Hex extends d.Table.with(d.EncryptionModifier) {}
  decorate(Strict, { value: [d.Encrypted({ secretKey: goodKey }), d.Field("string")] });
  decorate(Hex, { value: [d.Encrypted({ secretKey: hexKey }), d.Field("string")] });
  d.RegisterTable("strict", "enckey")(Strict);
  d.RegisterTable("hex", "enckey")(Hex);
  await d.RegisterSchema("enckey");
  const strict = d.GetModel(d.BasicDataModel(Strict));
  const hex = d.GetModel(d.BasicDataModel(Hex));
  const [id] = await strict.insert({ value: "kept" });
  return {
    hexKeyBytes: Buffer.byteLength(hexKey),
    hexRefused: await rejection(hex.insert({ value: "refused" })),
    goodStored: (await strict.get(id)).value,
    hexStored: (await hex.getAll()).length,
  };
`;

export const ENCRYPTION_JOURNEYS = {
  "encryption-at-rest": scenario({
    title: "an encrypted field is stored as base64 ciphertext, iv and auth tag that only the key opens",
    body: AT_REST,
    printed: "{\"read\":[\"4242 4242 4242 4242\",{\"ssn\":\"078-05-1120\",\"birthDate\":\"1990-01-01\"},\"old cipher\",\"twelve\"],\"topLevelHoldsNoCiphertext\":true,\"gcmShape\":[true,3,\"string\"],\"cbcShape\":[3,null],\"ivBytes\":[16,12],\"plaintextAbsent\":true,\"independentDecrypt\":[\"\\\"4242 4242 4242 4242\\\"\",\"{\\\"ssn\\\":\\\"078-05-1120\\\",\\\"birthDate\\\":\\\"1990-01-01\\\"}\",\"\\\"old cipher\\\"\"],\"sameValueTwice\":[true,true]}",
    stored: [
      {
        name: "the stored triples",
        expression: "$DB.getCollection('enc__vaults').find({ owner: 'Ann' }).toArray().map((r) => [Object.keys(r._internal.data).sort(), r._internal.data.card.length, r._internal.data.legacy.length, r.card === undefined])",
        expected: "[[[\"card\",\"legacy\",\"personal\",\"short\"],3,3,true]]",
      },
    ],
  }),
  "encryption-dates": scenario({ title: "an encrypted Date comes back as a Date with whole-second precision", body: DATES, printed: "{\"isDate\":true,\"iso\":\"2026-01-02T03:04:05.000Z\",\"storedText\":{\"value\":\"Fri, 02 Jan 2026 03:04:05 GMT\",\"type\":\"Date\"},\"lookalikeKept\":{\"type\":\"Date\",\"value\":\"not a date\",\"extra\":1}}" }),
  "encryption-keys": scenario({ title: "the key goes to the cipher as a UTF-8 string, so a hex-encoded key is refused", body: KEYS, printed: "{\"hexKeyBytes\":64,\"hexRefused\":{\"name\":\"RangeError\",\"message\":\"Invalid key length\"},\"goodStored\":\"kept\",\"hexStored\":0}" }),
} satisfies { [id: string]: Journey };
