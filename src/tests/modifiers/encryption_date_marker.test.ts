import { expect } from "chai";
import { Field, Table } from "../../table";
import { Encrypted, EncryptionModifier } from "../../modifiers/encryption";

type Stored =
  | null
  | string
  | number
  | Date
  | Stored[]
  | { [key: string]: Stored };

class Card extends Table.with(EncryptionModifier) {
  @Encrypted({ secretKey: "12345678901234567890123456789012" })
  @Field("any")
  declare payload: Stored;
}

class DatedCard extends Table.with(EncryptionModifier) {
  @Encrypted({ secretKey: "12345678901234567890123456789012" })
  @Field("any")
  declare payload: { at: Date };
}

function roundTrip(stored: Stored) {
  const card = new Card();
  card.payload = stored;
  return card.payload;
}

describe("Modifiers - encryption - Date marker", () => {
  it("returns a Date as a Date", async () => {
    const date = new Date("2022-12-01T10:20:30Z");

    const read = roundTrip({ at: date });

    expect(read).to.deep.equal({ at: date });
  });

  it("returns a Date held at the top level as a Date", async () => {
    const date = new Date("2022-12-01T10:20:30Z");

    const read = roundTrip(date);

    expect(read).to.be.instanceOf(Date);
    expect(read).to.deep.equal(date);
  });

  it("returns an invalid Date as an invalid Date", async () => {
    const dated = new DatedCard();
    dated.payload = { at: new Date(Number.NaN) };

    expect(dated.payload.at).to.be.instanceOf(Date);
    expect(Number.isNaN(dated.payload.at.getTime())).to.equal(true);
  });

  for (const stored of [
    { type: "Date", value: 123 },
    { type: "Date", value: "not a date" },
    { type: "Date", value: "2022-12-01" },
    { type: "Date", value: null },
    { type: "Date", value: ["Thu, 01 Dec 2022 10:20:30 GMT"] },
    { type: "Date", value: { year: 2022 } },
  ]) {
    it(`returns ${JSON.stringify(stored)} as stored`, async () => {
      expect(roundTrip(stored)).to.deep.equal(stored);
      expect(roundTrip({ nested: stored })).to.deep.equal({ nested: stored });
    });
  }

  it("returns an object with other keys than the marker's as stored", async () => {
    const stored = {
      type: "Date",
      value: "Thu, 01 Dec 2022 10:20:30 GMT",
      note: "kept",
    };

    expect(roundTrip(stored)).to.deep.equal(stored);
  });

  it("returns an object of another type as stored", async () => {
    const stored = { type: "Money", value: "Thu, 01 Dec 2022 10:20:30 GMT" };

    expect(roundTrip(stored)).to.deep.equal(stored);
  });
});
