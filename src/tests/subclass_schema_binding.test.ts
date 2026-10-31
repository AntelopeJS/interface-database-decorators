import { expect } from "chai";
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
    expect(model.database.build()[0].options.id).to.equal(
      "binding-before-schema",
    );
    expect(Admin.table().build()[0].options.id).to.equal(
      "binding-before-schema",
    );
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
    expect(model.database.build()[0].options.id).to.equal(
      "binding-after-schema",
    );
    expect(Admin.table().build()[0].options.id).to.equal(
      "binding-after-schema",
    );
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

    expect(Parent.table().build()[0].options.id).to.equal(
      "binding-parent-schema",
    );
    expect(Child.table().build()[0].options.id).to.equal(
      "binding-child-schema",
    );
  });
});
