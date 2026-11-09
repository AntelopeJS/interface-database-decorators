import { expect } from "chai";
import { Table } from "../../table";
import {
  attachModifier,
  getModifiedFields,
  lock,
  toDatabase,
  TwoWayModifier,
  unlock,
} from "../../modifiers/common";

const field = Symbol("field");

class PrefixModifier extends TwoWayModifier<string, [prefix: string]> {
  public override lock(
    _locked: string | undefined,
    value: string,
    prefix: string,
  ) {
    return `${prefix}:${value}`;
  }
  public override unlock(locked: string, prefix: string) {
    return locked.slice(prefix.length + 1);
  }
}

class AutoModifier extends TwoWayModifier<string[]> {
  public readonly autolock = true;
  public readonly autounlock = true;
  public override lock(_locked: string[] | undefined, value: string) {
    return [value];
  }
  public override unlock(locked: string[]) {
    return locked[0];
  }
}

function autoRow() {
  class AutoRow extends Table {
    declare [field]: string;
  }
  attachModifier(AutoRow, AutoModifier, field, {});
  return AutoRow;
}

describe("Modifiers - symbol-named fields", () => {
  it("locks and unlocks a symbol-named field on first write", () => {
    const row = new (autoRow())();
    row[field] = "value";
    expect(row[field]).to.equal("value");
    expect(toDatabase(row)._internal?.data[field]).to.deep.equal(["value"]);
  });

  it("locks a symbol-named field with lock() arguments", () => {
    class PrefixRow extends Table {
      declare [field]: string;
    }
    attachModifier(PrefixRow, PrefixModifier, field, {});
    const row = new PrefixRow();
    row[field] = "value";
    lock(row, PrefixModifier, [field], "p");
    expect(toDatabase(row)._internal?.data[field]).to.equal("p:value");
    unlock(row, PrefixModifier, [field], "p");
    expect(row[field]).to.equal("value");
  });

  it("keeps a symbol-named field modified in a subclass", () => {
    class ChildRow extends autoRow() {}
    const row = new ChildRow();
    row[field] = "value";
    expect(row[field]).to.equal("value");
  });

  it("lists a symbol-named field among the modified fields", () => {
    expect(getModifiedFields(new (autoRow())(), AutoModifier)).to.deep.equal([
      field,
    ]);
  });
});
