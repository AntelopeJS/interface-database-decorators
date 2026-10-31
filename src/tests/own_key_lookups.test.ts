import { expect } from "chai";
import { getTablesForSchema, RegisterTable } from "../schema";
import { Index, Table } from "../table";
import { DatumStaticMetadata, getMetadata } from "../common";
import { ContainerModifier } from "../modifiers/common";
import { LocalizationModifier } from "../modifiers/localization";

const PROTOTYPE_MEMBER_NAMES = [
  "toString",
  "constructor",
  "hasOwnProperty",
  "valueOf",
];

describe("Lookups by name - names shared with Object.prototype members", () => {
  it("answers no tables for a schema nothing registered", async () => {
    for (const name of PROTOTYPE_MEMBER_NAMES) {
      expect(getTablesForSchema(name)).to.equal(undefined);
    }
  });

  for (const name of PROTOTYPE_MEMBER_NAMES) {
    it(`answers nothing for ${name} in a container modifier`, async () => {
      expect(new ContainerModifier().unlock({ en: "x" }, name)).to.equal(
        undefined,
      );
    });

    it(`answers the stored ${name} entry of a container modifier`, async () => {
      expect(
        new ContainerModifier().unlock(
          Object.fromEntries([[name, "stored"]]),
          name,
        ),
      ).to.equal("stored");
    });

    it(`falls back when a localized field is read in the locale ${name}`, async () => {
      const modifier = new LocalizationModifier();
      Object.assign(modifier, { options: { fallbackLocale: "en" } });

      expect(modifier.unlock({ en: "Hello" }, name)).to.equal("Hello");
    });

    it(`groups an index named ${name}`, async () => {
      class Row extends Table {}
      Index()(Row.prototype, name);
      Index({ group: name })(Row.prototype, "other");

      expect(getMetadata(Row, DatumStaticMetadata).indexes).to.deep.equal(
        Object.fromEntries([[name, [name, "other"]]]),
      );
    });

    it(`registers the tables of a schema named ${name}`, async () => {
      class Row extends Table {}
      RegisterTable("rows", name)(Row);

      expect(getTablesForSchema(name)).to.deep.equal({ rows: Row });
      expect(getTablesForSchema(`${name}-never-registered`)).to.equal(
        undefined,
      );
    });
  }
});
