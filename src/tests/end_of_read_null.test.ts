import { expect } from "chai";
import { MakePropertyDecorator } from "@antelopejs/interface-core/decorators";
import { Field, Table } from "../table";
import {
  attachModifier,
  fromDatabase,
  MixinSymbol,
  TwoWayModifier,
  unlock,
} from "../modifiers/common";
import { LocalizationModifier, Localized } from "../modifiers/localization";

class WrapModifier extends TwoWayModifier<[text: string]> {
  readonly autolock = true;
  readonly autounlock = true;

  public override lock(_locked: [text: string] | undefined, value: string) {
    return [value] satisfies [text: string];
  }

  public override unlock([text]: [text: string]) {
    return text;
  }

  [MixinSymbol] = class {};
}

const Wrapped = MakePropertyDecorator((target, propertyKey) => {
  attachModifier(target.constructor, WrapModifier, propertyKey, {});
});

describe("Modified fields - a read that finds no value", () => {
  class Page extends Table.with(LocalizationModifier, WrapModifier) {
    @Localized() @Wrapped() @Field("string") declare title?: string;
    @Localized() @Field("string") declare summary?: string;
  }

  function pageInEnglish() {
    const stored = {
      _id: "page-1",
      _internal: {
        meta: {},
        data: { title: { en: ["Hello"] }, summary: { en: "Greeting" } },
      },
    };
    return fromDatabase(stored, Page).localize("en");
  }

  it("never passes null to a two-way modifier stacked after @Localized()", () => {
    const page = pageInEnglish();
    unlock(page, LocalizationModifier, undefined, undefined);

    expect(page.title).to.equal(null);
    expect(JSON.parse(JSON.stringify(page))).to.deep.include({ title: null });
  });

  it("reads null for a locale with no value and no fallback", () => {
    const page = pageInEnglish();
    const english = { title: page.title, summary: page.summary };
    page.localize("de");

    expect(english).to.deep.equal({ title: "Hello", summary: "Greeting" });
    expect(page.summary).to.equal(null);
    expect(page.title).to.equal(null);
  });

  it("reads undefined for a field the row does not store", () => {
    const page = new Page().localize("en");

    expect(page.summary).to.equal(undefined);
  });
});
