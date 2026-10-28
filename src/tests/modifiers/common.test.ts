import { expect } from "chai";
import { Field, Table } from "@antelopejs/interface-database-decorators/table";
import {
  attachModifier,
  ContainerModifier,
  fromDatabase,
  getModifiedFields,
  Modifier,
  OneWayModifier,
  TwoWayModifier,
  toDatabase,
} from "@antelopejs/interface-database-decorators/modifiers/common";

describe("Modifiers - common: modifier classes", () => {
  it("creates basic modifier", async () => {
    class TestModifier extends Modifier<any, any> {
      public lock(v: any): any {
        return v;
      }
    }

    const modifier = new TestModifier();
    expect(modifier).to.be.instanceOf(Modifier);
  });
  it("creates one way modifier", async () => {
    class TestOneWayModifier extends OneWayModifier<string, [string]> {
      lock(_: string | undefined, value: string, prefix: string): string {
        return `${prefix}_${String(value)}`;
      }

      test(lockedValue: string, value: string, prefix: string): boolean {
        return this.lock(undefined, value, prefix) === lockedValue;
      }
    }

    const mod = new TestOneWayModifier();
    const locked = mod.lock(undefined, "val", "prefix");
    expect(locked).to.equal("prefix_val");
    expect(mod.test(locked, "val", "prefix")).to.equal(true);
  });
  it("creates two way modifier", async () => {
    class TestTwoWayModifier extends TwoWayModifier<string, [string]> {
      lock(_: string | undefined, value: string, prefix: string): string {
        return `${prefix}_${String(value)}`;
      }

      unlock(lockedValue: string, prefix: string): string {
        return lockedValue.replace(`${prefix}_`, "");
      }
    }

    const mod = new TestTwoWayModifier();
    const locked = mod.lock(undefined, "value", "pre");
    const unlocked = mod.unlock(locked, "pre");
    expect(unlocked).to.equal("value");
  });
  it("creates container modifier", async () => {
    class TestContainer extends ContainerModifier {}

    const mod = new TestContainer();

    const data1 = mod.lock(undefined, "val", "key1");
    expect(data1).to.deep.equal({ key1: "val" });

    const data2 = mod.lock(data1, "val2", "key2");
    expect(data2).to.deep.equal({ key1: "val", key2: "val2" });

    const result = mod.unlock(data2, "key1");
    expect(result).to.equal("val");
  });
  it("passes options to modifier via attachModifier()", async () => {
    interface Opts {
      suffix: string;
    }

    class SuffixModifier extends OneWayModifier<string, [], object, Opts> {
      public readonly autolock = true;
      lock(_: string | undefined, value: string): string {
        return `${String(value)}${this.options.suffix}`;
      }
    }
    class TestTable extends Table {
      @Field("string")
      declare name: string;
    }

    attachModifier(TestTable, SuffixModifier, "name", { suffix: "_suffix" });
    const row = new TestTable();
    row.name = "hello";
    expect(row.name).to.equal("hello_suffix");
  });
});

describe("Modifiers - common: attachment and conversion", () => {
  it("attaches multiple modifiers on same field", async () => {
    class Prefix extends OneWayModifier<
      string,
      [],
      object,
      { prefix: string }
    > {
      lock(_: string | undefined, value: string): string {
        return `${this.options.prefix}${String(value)}`;
      }
    }

    class Suffix extends TwoWayModifier<
      string,
      [],
      object,
      { suffix: string }
    > {
      lock(_: string | undefined, value: string): string {
        return `${String(value)}${this.options.suffix}`;
      }

      unlock(lockedValue: string): string {
        return lockedValue.replace(this.options.suffix, "");
      }
    }

    class TestTable extends Table {
      @Field("string")
      name!: string;
    }

    attachModifier(TestTable, Prefix, "name", { prefix: "pre_" });
    expect(() => {
      attachModifier(TestTable, Suffix, "name", { suffix: "_suffix" });
    }).to.throw(/please review your ordering/);
  });
  it("throws if adding OneWayModifier after another OneWayModifier", async () => {
    class Mod1 extends OneWayModifier<string, []> {
      lock(_: string | undefined, val: string): string {
        return `#${String(val)}`;
      }
    }

    class Mod2 extends OneWayModifier<string, []> {
      lock(_: string | undefined, val: string): string {
        return `@${String(val)}`;
      }
    }

    class TestTable extends Table {
      @Field("string")
      name!: string;
    }

    attachModifier(TestTable, Mod1, "name", {});
    expect(() => {
      attachModifier(TestTable, Mod2, "name", {});
    }).to.throw(/already has a One-Way Modifier/);
  });
  it("converts database data to table instance", async () => {
    class TestTable extends Table {
      @Field("string")
      name!: string;
      @Field("number")
      age!: number;
    }

    const dbRow = { _id: "1", name: "John", age: 40 };
    const instance = fromDatabase(dbRow, TestTable);

    expect(instance).to.be.instanceOf(TestTable);
    expect(instance.name).to.equal("John");
    expect(instance.age).to.equal(40);
  });
  it("converts table instance to database data", async () => {
    class TestTable extends Table {
      @Field("string")
      name!: string;
      @Field("number")
      age!: number;
    }

    const instance = new TestTable();
    instance.name = "Eva";
    instance.age = 22;

    const db = toDatabase(instance);
    expect(db.name).to.equal("Eva");
    expect(db.age).to.equal(22);
  });
  it("gets modified fields", async () => {
    class TestMod extends OneWayModifier<string, []> {
      lock(_: string | undefined, v: string): string {
        return `mod_${String(v)}`;
      }
    }

    class TestTable extends Table {
      @Field("string")
      name!: string;
      @Field("number")
      age!: number;
    }

    attachModifier(TestTable, TestMod, "name", { prefix: "mod" });
    const row = new TestTable();
    const fields = getModifiedFields(row, TestMod);
    expect(fields).to.deep.equal(["name"]);
  });
});
