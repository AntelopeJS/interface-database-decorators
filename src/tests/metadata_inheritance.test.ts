import { expect } from "chai";
import { RegisterTable } from "../schema";
import { Field, Fixture, Index, Table } from "../table";
import { Relation, RelationStaticMetadata } from "../relation";
import { DatumStaticMetadata, getMetadata } from "../common";
import { Hashed, HashModifier } from "../modifiers/hash";
import {
  attachModifier,
  getModifiedFields,
  ModifiersStaticMetadata,
  OneWayModifier,
} from "../modifiers/common";

const schemaName = "metadata-inheritance-schema";

function fieldsOf(tableClass: typeof Table) {
  return Object.keys(getMetadata(tableClass, DatumStaticMetadata).fields);
}

describe("Metadata - subclasses of a table", () => {
  it("keeps the table name and fields of each subclass apart", async () => {
    class Base extends Table {
      @Field("string")
      declare createdBy: string;
    }

    @RegisterTable("inheritance_users", schemaName)
    class Users extends Base {
      @Field("string")
      declare email: string;
    }

    @RegisterTable("inheritance_posts", schemaName)
    class Posts extends Base {
      @Field("string")
      declare title: string;
    }

    expect(getMetadata(Users, DatumStaticMetadata).tableName).to.equal(
      "inheritance_users",
    );
    expect(getMetadata(Posts, DatumStaticMetadata).tableName).to.equal(
      "inheritance_posts",
    );
    expect(getMetadata(Base, DatumStaticMetadata).tableName).to.equal(
      undefined,
    );
    expect(fieldsOf(Base)).to.deep.equal(["createdBy"]);
    expect(fieldsOf(Users)).to.deep.equal(["createdBy", "email"]);
    expect(fieldsOf(Posts)).to.deep.equal(["createdBy", "title"]);
  });

  it("keeps the indexes of each subclass apart", async () => {
    class Base extends Table {
      @Index()
      declare slug: string;
    }

    class Users extends Base {
      @Index({ group: "slug", crossInstance: true })
      declare handle: string;
    }

    class Posts extends Base {
      @Index({ unique: true })
      declare title: string;
    }

    const base = getMetadata(Base, DatumStaticMetadata);
    const users = getMetadata(Users, DatumStaticMetadata);
    const posts = getMetadata(Posts, DatumStaticMetadata);

    expect(base.indexes).to.deep.equal({ slug: ["slug"] });
    expect(users.indexes).to.deep.equal({ slug: ["slug", "handle"] });
    expect(posts.indexes).to.deep.equal({ slug: ["slug"], title: ["title"] });
    expect([...base.crossInstanceIndexes]).to.deep.equal([]);
    expect([...users.crossInstanceIndexes]).to.deep.equal(["slug"]);
    expect([...base.uniqueIndexes]).to.deep.equal([]);
    expect([...posts.uniqueIndexes]).to.deep.equal(["title"]);
  });
});

describe("Metadata - subclasses of a table with fixtures, modifiers and relations", () => {
  it("keeps the generator of each subclass apart", async () => {
    class Base extends Table {
      @Field("string")
      declare name: string;
    }

    @Fixture(() => ({ name: "user" }))
    class Users extends Base {}

    @Fixture(() => ({ name: "post" }))
    class Posts extends Base {}

    const generators = [Base, Users, Posts].map(
      (tableClass) => getMetadata(tableClass, DatumStaticMetadata).generator,
    );

    expect(generators[0]).to.equal(undefined);
    expect(generators[1]).to.be.a("function");
    expect(generators[2]).to.be.a("function");
    expect(generators[1]).to.not.equal(generators[2]);
  });

  it("keeps the modified fields of each subclass apart", async () => {
    class Base extends Table.with(HashModifier) {
      @Hashed()
      declare token: string;
    }

    class Users extends Base {
      @Hashed()
      declare password: string;
    }

    class Posts extends Base {
      @Hashed()
      declare secret: string;
    }

    expect(getModifiedFields(new Base(), HashModifier)).to.deep.equal([
      "token",
    ]);
    expect(getModifiedFields(new Users(), HashModifier)).to.deep.equal([
      "token",
      "password",
    ]);
    expect(getModifiedFields(new Posts(), HashModifier)).to.deep.equal([
      "token",
      "secret",
    ]);
  });

  it("keeps the modifier events of each subclass apart", async () => {
    class Stamp extends OneWayModifier<string> {
      public override lock(_locked: string | undefined, value: string) {
        return value;
      }

      public toDatabase() {}
    }

    class Base extends Table {
      declare createdBy: string;
    }
    attachModifier(Base, Stamp, "createdBy", {});

    class Users extends Base {
      declare email: string;
    }
    attachModifier(Users, Stamp, "email", {});

    const events = (tableClass: typeof Table) =>
      getMetadata(tableClass, ModifiersStaticMetadata).events.get("toDatabase");

    expect(events(Base)).to.have.length(1);
    expect(events(Users)).to.have.length(2);
  });

  it("keeps the relations of each subclass apart", async () => {
    class Target extends Table {}

    class Base extends Table {
      @Relation({ to: () => Target })
      declare owner: string;
    }

    class Users extends Base {
      @Relation({ to: () => Target })
      declare team: string;
    }

    const relationsOf = (tableClass: typeof Table) =>
      Object.keys(getMetadata(tableClass, RelationStaticMetadata).relations);

    expect(relationsOf(Base)).to.deep.equal(["owner"]);
    expect(relationsOf(Users)).to.deep.equal(["owner", "team"]);
  });

  it("starts a subclass from the metadata its parent holds", async () => {
    class Base extends Table {
      @Field("string")
      declare createdBy: string;
    }

    @RegisterTable("inheritance_inherited", schemaName)
    class Registered extends Base {}

    class Child extends Registered {}

    expect(getMetadata(Child, DatumStaticMetadata).tableName).to.equal(
      "inheritance_inherited",
    );
    expect(fieldsOf(Child)).to.deep.equal(["createdBy"]);
  });
});
