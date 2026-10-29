import path from "node:path";
import { expect } from "chai";
import * as Database from "@antelopejs/interface-database";
import * as DatabaseSchema from "@antelopejs/interface-database/schema";

import * as Decorators from "../index";
import { CreateOtherInstance } from "./helpers/other-instance";

type DecoratorsModule = typeof Decorators;
type StagedSchemaModule = Pick<typeof DatabaseSchema, "Schema">;

const buildFolder = path.resolve(__dirname, "..");
const databaseFolder = path.join(
  path.dirname(require.resolve("@antelopejs/interface-database/package.json")),
  "dist",
);
const otherInstance = CreateOtherInstance([buildFolder, databaseFolder]);

function isDecoratorsModule(
  candidate: Partial<DecoratorsModule>,
): candidate is DecoratorsModule {
  return Object.keys(Decorators).every((name) => name in candidate);
}

function isStagedSchemaModule(
  candidate: Partial<StagedSchemaModule>,
): candidate is StagedSchemaModule {
  return "Schema" in candidate;
}

function loadDecorators(): DecoratorsModule {
  const loaded = otherInstance(path.join(buildFolder, "index.js"));
  if (!isDecoratorsModule(loaded)) {
    throw new Error("The other instance does not expose the decorators");
  }
  return loaded;
}

function loadStagedSchema(): StagedSchemaModule {
  const loaded = otherInstance(
    path.join(databaseFolder, "staged-query", "schema.js"),
  );
  if (!isStagedSchemaModule(loaded)) {
    throw new Error("The other instance does not expose the schema exports");
  }
  return loaded;
}

const Other = loadDecorators();
const OtherStagedSchema = loadStagedSchema();

const boundSchemaId = "cross-instance-bound";

class Item extends Decorators.Table {
  declare name: string;
}
Decorators.RegisterTable("items", boundSchemaId)(Item);

class Orphan extends Decorators.Table {}
Decorators.RegisterTable("orphans", "cross-instance-never-registered")(Orphan);

class Prefix extends Decorators.TwoWayModifier<string, [string]> {
  lock(_: string | undefined, value: string, prefix: string): string {
    return `${prefix}_${String(value)}`;
  }

  unlock(lockedValue: string, prefix: string): string {
    return lockedValue.replace(`${prefix}_`, "");
  }
}

class Labelled extends Decorators.Table {
  declare label: string;
}
Decorators.attachModifier(Labelled, Prefix, "label", {});

describe("Tables and models across interface instances", () => {
  before(async () => {
    await Decorators.RegisterSchema(boundSchemaId);
    new OtherStagedSchema.Schema(boundSchemaId, {});
  });

  it(
    "BasicDataModel reads a table class decorated through another instance (the DMS builds models of generated modules' tables)",
    BasicDataModelReadsOtherInstanceTest,
  );
  it(
    "Table.table() returns the class's table in the schema RegisterSchema bound it to: default instance, an instance id, a given SchemaInstance (data-api and modules open tables with it)",
    TableOpensBoundSchemaTest,
  );
  it(
    "Table.table() on a class no RegisterSchema bound throws, naming the class (no silent lookup by id)",
    UnboundTableThrowsTest,
  );
  it(
    "GetModel from another instance builds the model on the table class's schema, even when that instance holds a schema with the same id (interface-dms TenantScopedModel)",
    GetModelFromOtherInstanceTest,
  );
  it(
    "lock from another instance acts on the object's modifier state (data-api Validation.Lock)",
    LockFromOtherInstanceTest,
  );
});

function stagesOf(query: Database.Table<any>) {
  return query
    .build()
    .map(({ stage, options }) => [stage, options?.id] as const);
}

function BasicDataModelReadsOtherInstanceTest() {
  class Remote extends Other.Table {}
  Other.RegisterTable("remotes", "cross-instance-remote")(Remote);
  const RemoteModel = Decorators.BasicDataModel(Remote);
  expect(RemoteModel.schemaName).to.equal("cross-instance-remote");
}

function TableOpensBoundSchemaTest() {
  const bound = Database.Schema.get(boundSchemaId);
  expect(bound).to.not.equal(undefined);
  expect(Item.table()).to.be.instanceOf(Database.Table);
  expect(stagesOf(Item.table())).to.deep.equal([
    ["schema", boundSchemaId],
    ["instance", undefined],
    ["table", "items"],
  ]);
  expect(stagesOf(Item.table("t1"))[1]).to.deep.equal(["instance", "t1"]);
  expect(stagesOf(Item.table(bound!.instance("t2")))[1]).to.deep.equal([
    "instance",
    "t2",
  ]);
}

function UnboundTableThrowsTest() {
  expect(() => Orphan.table()).to.throw(/Orphan is not bound to a schema/);
}

function GetModelFromOtherInstanceTest() {
  const ItemModel = Decorators.BasicDataModel(Item);
  const model = Other.GetModel(ItemModel, "t3");
  expect(model.database).to.be.instanceOf(Database.SchemaInstance);
  expect(model.database.build()[0].options.id).to.equal(boundSchemaId);
}

function LockFromOtherInstanceTest() {
  const row = new Labelled();
  Other.lock(row, Prefix, undefined, "p");
  row.label = "v";
  expect(Decorators.toDatabase(row)).to.have.nested.property(
    "_internal.data.label",
    "p_v",
  );
}
