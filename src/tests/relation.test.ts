import { getMetadata } from "@antelopejs/interface-database-decorators/common";
import {
  Relation,
  RelationStaticMetadata,
} from "@antelopejs/interface-database-decorators/relation";
import { Table } from "@antelopejs/interface-database-decorators/table";
import { expect } from "chai";

describe("Relation - Relation decorator", () => {
  it("stores relation options in metadata", async () =>
    StoreRelationOptionsInMetadataTest());
  it("stores toField and many options", async () =>
    StoreToFieldAndManyOptionsTest());
  it("supports multiple relations on one class", async () =>
    SupportMultipleRelationsOnOneClassTest());
  it("resolves forward references through the thunk", async () =>
    ResolveForwardReferencesThroughThunkTest());
  it("keeps metadata separate between classes", async () =>
    KeepMetadataSeparateBetweenClassesTest());
});

async function StoreRelationOptionsInMetadataTest() {
  class TargetTable extends Table {
    name!: string;
  }

  class SourceTable extends Table {
    @Relation({ to: () => TargetTable })
    target!: string;
  }

  const metadata = getMetadata(SourceTable, RelationStaticMetadata);
  expect(metadata.relations).to.have.property("target");
  expect(metadata.relations.target.to()).to.equal(TargetTable);
  expect(metadata.relations.target.toField).to.equal(undefined);
  expect(metadata.relations.target.many).to.equal(undefined);
}

async function StoreToFieldAndManyOptionsTest() {
  class TargetTable extends Table {
    code!: string;
  }

  class SourceTable extends Table {
    @Relation({ to: () => TargetTable, toField: "code", many: true })
    targets!: string[];
  }

  const metadata = getMetadata(SourceTable, RelationStaticMetadata);
  expect(metadata.relations.targets.toField).to.equal("code");
  expect(metadata.relations.targets.many).to.equal(true);
}

async function SupportMultipleRelationsOnOneClassTest() {
  class UserTable extends Table {
    name!: string;
  }

  class RoleTable extends Table {
    label!: string;
  }

  class SourceTable extends Table {
    @Relation({ to: () => UserTable })
    owner!: string;

    @Relation({ to: () => RoleTable, many: true })
    roles!: string[];
  }

  const metadata = getMetadata(SourceTable, RelationStaticMetadata);
  expect(Object.keys(metadata.relations)).to.have.members(["owner", "roles"]);
  expect(metadata.relations.owner.to()).to.equal(UserTable);
  expect(metadata.relations.roles.to()).to.equal(RoleTable);
}

async function ResolveForwardReferencesThroughThunkTest() {
  class SourceTable extends Table {
    @Relation({ to: () => LaterTable })
    later!: string;
  }

  class LaterTable extends Table {
    name!: string;
  }

  const metadata = getMetadata(SourceTable, RelationStaticMetadata);
  expect(metadata.relations.later.to()).to.equal(LaterTable);
}

async function KeepMetadataSeparateBetweenClassesTest() {
  class TargetTable extends Table {
    name!: string;
  }

  class FirstTable extends Table {
    @Relation({ to: () => TargetTable })
    target!: string;
  }

  class SecondTable extends Table {
    other!: string;
  }

  const firstMetadata = getMetadata(FirstTable, RelationStaticMetadata);
  const secondMetadata = getMetadata(SecondTable, RelationStaticMetadata);
  expect(firstMetadata.relations).to.have.property("target");
  expect(secondMetadata.relations).to.not.have.property("target");
}
