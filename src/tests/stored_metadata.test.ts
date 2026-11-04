import { expect } from "chai";
import { Index, Table } from "../table";
import { DatumStaticMetadata, getMetadata } from "../common";

/**
 * The table metadata as copies 0.1.8 and 0.1.9 of the package store it under
 * the shared metadata key, before `uniqueIndexes` was added to its shape.
 */
class LegacyDatumStaticMetadata {
  public tableName?: string;
  public schemaName?: string;
  public readonly indexes: Record<string, Array<string>> = {};
  public readonly crossInstanceIndexes = new Set<string>();
  public readonly fields: DatumStaticMetadata["fields"] = {};
  public primary: string = "_id";
  public generator?: DatumStaticMetadata["generator"];
  public schema?: DatumStaticMetadata["schema"];

  addIndex(key: string, group: string, isCrossInstance: boolean = false) {
    if (!Object.hasOwn(this.indexes, group)) {
      this.indexes[group] = [];
    }
    this.indexes[group].push(key);
    if (isCrossInstance) {
      this.crossInstanceIndexes.add(group);
    }
  }
}

function declaredByLegacyCopy(tableClass: typeof Table) {
  const legacy = new LegacyDatumStaticMetadata();
  legacy.tableName = "legacy_rows";
  legacy.schemaName = "legacy-schema";
  legacy.primary = "code";
  legacy.addIndex("email", "email");
  legacy.addIndex("name", "search", true);
  legacy.addIndex("city", "search");
  Reflect.defineMetadata(DatumStaticMetadata.key, legacy, tableClass);
  return legacy;
}

describe("Metadata - stored by an older copy of the package", () => {
  it("reads the metadata as the current shape", async () => {
    class Row extends Table {}
    declaredByLegacyCopy(Row);

    const metadata = getMetadata(Row, DatumStaticMetadata);

    expect(metadata).to.be.instanceOf(DatumStaticMetadata);
    expect([...metadata.uniqueIndexes]).to.deep.equal([]);
    expect(metadata.uniqueIndexes.has("email")).to.equal(false);
  });

  it("keeps what the older copy stored", async () => {
    class Row extends Table {}
    declaredByLegacyCopy(Row);

    const metadata = getMetadata(Row, DatumStaticMetadata);

    expect(metadata.tableName).to.equal("legacy_rows");
    expect(metadata.schemaName).to.equal("legacy-schema");
    expect(metadata.primary).to.equal("code");
    expect(metadata.indexes).to.deep.equal({
      email: ["email"],
      search: ["name", "city"],
    });
    expect([...metadata.crossInstanceIndexes]).to.deep.equal(["search"]);
  });

  it("answers the same metadata on every read", async () => {
    class Row extends Table {}
    declaredByLegacyCopy(Row);

    expect(getMetadata(Row, DatumStaticMetadata)).to.equal(
      getMetadata(Row, DatumStaticMetadata),
    );
  });

  it("records a unique index declared after the older copy", async () => {
    class Row extends Table {}
    declaredByLegacyCopy(Row);

    Index({ unique: true })(Row.prototype, "code");

    const metadata = getMetadata(Row, DatumStaticMetadata);
    expect([...metadata.uniqueIndexes]).to.deep.equal(["code"]);
    expect(metadata.indexes.code).to.deep.equal(["code"]);
  });

  it("starts a subclass from the metadata the older copy stored", async () => {
    class Base extends Table {}
    declaredByLegacyCopy(Base);
    class Child extends Base {}

    const metadata = getMetadata(Child, DatumStaticMetadata);

    expect(metadata).to.be.instanceOf(DatumStaticMetadata);
    expect(metadata.uniqueIndexes.has("email")).to.equal(false);
    expect(metadata.indexes).to.have.property("email");
  });
});
