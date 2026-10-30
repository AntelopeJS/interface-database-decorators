import { expect } from "chai";
import { Table } from "../../table";
import { Hashed, HashModifier } from "../../modifiers/hash";
import { LocalizationModifier, Localized } from "../../modifiers/localization";
import {
  attachModifier,
  getModifiedFields,
  OneWayModifier,
  triggerEvent,
} from "../../modifiers/common";

const PROTOTYPE_MEMBER_NAMES = [
  "toString",
  "valueOf",
  "hasOwnProperty",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "toLocaleString",
];

describe("Modifiers - names shared with Object.prototype members", () => {
  for (const name of PROTOTYPE_MEMBER_NAMES) {
    it(`attaches a modifier to a field named ${name}`, async () => {
      class Account extends Table.with(HashModifier) {}
      Hashed()(Account.prototype, name);

      expect(getModifiedFields(new Account(), HashModifier)).to.deep.equal([
        name,
      ]);
      expect(Object.getOwnPropertyDescriptor(Account.prototype, name))
        .to.have.property("set")
        .that.is.a("function");
    });

    it(`attaches a second modifier to a field named ${name}`, async () => {
      class Content extends Table.with(HashModifier, LocalizationModifier) {}
      Localized()(Content.prototype, name);
      Hashed()(Content.prototype, name);

      expect(getModifiedFields(new Content(), HashModifier)).to.deep.equal([
        name,
      ]);
      expect(
        getModifiedFields(new Content(), LocalizationModifier),
      ).to.deep.equal([name]);
    });
  }

  it("refuses a modified field named constructor", async () => {
    class Account extends Table.with(HashModifier) {}

    expect(() => Hashed()(Account.prototype, "constructor")).to.throw(
      "Account.constructor",
    );
    expect(Account.prototype.constructor).to.equal(Account);
  });

  it("keeps the fields of two tables apart", async () => {
    class Left extends Table.with(HashModifier) {}
    class Right extends Table.with(HashModifier) {}
    Hashed()(Left.prototype, "toString");
    Hashed()(Right.prototype, "valueOf");

    expect(getModifiedFields(new Left(), HashModifier)).to.deep.equal([
      "toString",
    ]);
    expect(getModifiedFields(new Right(), HashModifier)).to.deep.equal([
      "valueOf",
    ]);
  });

  for (const eventName of ["toString", "valueOf", "hasOwnProperty"]) {
    it(`registers a modifier method named ${eventName} as an event`, async () => {
      const calls: string[] = [];

      class Account extends Table {
        declare nickname: string;
      }
      class Watcher extends OneWayModifier<string> {
        public override lock(_locked: string | undefined, value: string) {
          return value;
        }
      }
      Object.defineProperty(Watcher.prototype, eventName, {
        value: (_row: Account, field: PropertyKey) => {
          calls.push(String(field));
        },
        configurable: true,
      });
      attachModifier(Account, Watcher, "nickname", {});

      triggerEvent(new Account(), eventName);

      expect(calls).to.deep.equal(["nickname"]);
    });
  }
});
