import { expect } from "chai";
import { Schema } from "@antelopejs/interface-database";
import { DatumStaticMetadata, getMetadata } from "../common";
import { boundSchema } from "../internal/bound-schema";
import { RegisterTable } from "../schema";
import { RegisterSchema } from "../database";
import { BasicDataModel, GetModel } from "../model";
import { Field, Table } from "../table";

describe("Schema binding - subclasses of a table", () => {
  it("binds a subclass whose model is built before RegisterSchema ran", async () => {
    @RegisterTable("binding_users", "binding-before-schema")
    class Users extends Table {
      @Field("string")
      declare name: string;
    }
    class Admin extends Users {}

    const AdminModel = BasicDataModel(Admin);
    await RegisterSchema("binding-before-schema");

    const model = GetModel(AdminModel, "binding-instance");
    expect(model.database.build()[0]).to.deep.include({
      stage: "schema",
      options: { id: "binding-before-schema" },
    });
    expect(Admin.table().build()[0]).to.deep.include({
      stage: "schema",
      options: { id: "binding-before-schema" },
    });
  });

  it("binds a subclass declared after RegisterSchema ran", async () => {
    @RegisterTable("binding_late_users", "binding-after-schema")
    class Users extends Table {
      @Field("string")
      declare name: string;
    }
    await RegisterSchema("binding-after-schema");
    class Admin extends Users {}

    const model = GetModel(BasicDataModel(Admin), "binding-instance");
    expect(model.database.build()[0]).to.deep.include({
      stage: "schema",
      options: { id: "binding-after-schema" },
    });
    expect(Admin.table().build()[0]).to.deep.include({
      stage: "schema",
      options: { id: "binding-after-schema" },
    });
  });

  it("binds a subclass that registers its own table to its own schema", async () => {
    @RegisterTable("binding_parents", "binding-parent-schema")
    class Parent extends Table {
      @Field("string")
      declare name: string;
    }
    @RegisterTable("binding_children", "binding-child-schema")
    class Child extends Parent {}

    await RegisterSchema("binding-parent-schema");
    await RegisterSchema("binding-child-schema");

    expect(Parent.table().build()[0]).to.deep.include({
      stage: "schema",
      options: { id: "binding-parent-schema" },
    });
    expect(Child.table().build()[0]).to.deep.include({
      stage: "schema",
      options: { id: "binding-child-schema" },
    });
  });

  it("follows the schema its parent is bound to when RegisterSchema runs again", async () => {
    @RegisterTable("binding_rebound", "binding-rebound-schema")
    class Users extends Table {
      @Field("string")
      declare name: string;
    }
    await RegisterSchema("binding-rebound-schema");
    class Admin extends Users {}
    const adminMetadata = getMetadata(Admin, DatumStaticMetadata);
    const first = boundSchema(adminMetadata);

    await RegisterSchema("binding-rebound-schema");

    const second = Schema.get("binding-rebound-schema");
    expect(second).to.not.equal(first);
    expect(boundSchema(adminMetadata)).to.equal(second);
  });
});
