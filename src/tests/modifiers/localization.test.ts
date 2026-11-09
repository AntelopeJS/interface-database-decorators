import { expect } from "chai";
import { Field, Table } from "../../table";
import {
  fromDatabase,
  fromPlainData,
  lock,
  toDatabase,
} from "../../modifiers/common";
import { HashModifier, Hashed } from "../../modifiers/hash";
import { LocalizationModifier, Localized } from "../../modifiers/localization";

describe("Modifiers - localization", () => {
  it("creates localization modifier", async () => {
    const modifier = new TestableLocalizationModifier();
    modifier.setOptions({ fallbackLocale: "en" });

    expect(modifier).to.be.instanceOf(LocalizationModifier);
    expect(modifier.getOptions().fallbackLocale).to.equal("en");
  });
  it("stores multiple locale values", async () => {
    const modifier = new TestableLocalizationModifier();
    modifier.setOptions({ fallbackLocale: "en" });

    const enValue = "Hello World";
    const frValue = "Bonjour le Monde";
    const esValue = "Hola Mundo";

    const locked1 = modifier.lock(undefined, enValue, "en");
    const locked2 = modifier.lock(locked1, frValue, "fr");
    const locked3 = modifier.lock(locked2, esValue, "es");

    expect(locked3).to.deep.equal({
      en: enValue,
      fr: frValue,
      es: esValue,
    });
  });
  it("retrieves specific locale value", async () => {
    const modifier = new TestableLocalizationModifier();
    modifier.setOptions({ fallbackLocale: "en" });

    const data = {
      en: "Hello World",
      fr: "Bonjour le Monde",
      es: "Hola Mundo",
    };

    const enValue = modifier.unlock(data, "en");
    const frValue = modifier.unlock(data, "fr");
    const esValue = modifier.unlock(data, "es");

    expect(enValue).to.equal("Hello World");
    expect(frValue).to.equal("Bonjour le Monde");
    expect(esValue).to.equal("Hola Mundo");
  });
  it("falls back to default locale", async () => {
    const modifier = new TestableLocalizationModifier();
    modifier.setOptions({ fallbackLocale: "en" });

    const data = {
      en: "Hello World",
      fr: "Bonjour le Monde",
    };

    const missingValue = modifier.unlock(data, "es");

    expect(missingValue).to.equal("Hello World");
  });
  it("reads the fallback locale of a field", async () => {
    class TestTable extends Table.with(LocalizationModifier) {
      @Localized({ fallbackLocale: "fr" })
      @Field("string")
      declare title: string;

      @Localized()
      @Field("string")
      declare summary: string;

      @Field("string")
      declare code: string;
    }

    expect(LocalizationModifier.fallbackLocaleOf(TestTable, "title")).to.equal(
      "fr",
    );
    expect(
      LocalizationModifier.fallbackLocaleOf(TestTable, "summary"),
    ).to.equal(undefined);
    expect(LocalizationModifier.fallbackLocaleOf(TestTable, "code")).to.equal(
      undefined,
    );
  });
  it("falls back for an empty value", async () => {
    const modifier = new TestableLocalizationModifier();
    modifier.setOptions({ fallbackLocale: "en" });

    expect(modifier.unlock({ en: "Hello", fr: "" }, "fr")).to.equal("Hello");
  });
  it("stores an empty value as no value", async () => {
    const modifier = new TestableLocalizationModifier();
    modifier.setOptions({ fallbackLocale: "en" });

    const cleared = modifier.lock({ en: "Hello", fr: "Bonjour" }, "", "fr");
    const everyLanguage = modifier.lock(
      undefined,
      { en: "Hello", fr: "" },
      "*",
    );

    expect(cleared).to.deep.equal({ en: "Hello" });
    expect(everyLanguage).to.deep.equal({ en: "Hello" });
  });
  it("answers the fallback locale when no locale is given", async () => {
    const modifier = new TestableLocalizationModifier();
    modifier.setOptions({ fallbackLocale: "en" });

    const locked = modifier.lock({ en: "Hello" }, "Ignored", undefined);

    expect(locked).to.deep.equal({ en: "Hello" });
    expect(
      modifier.unlock({ en: "Hello", undefined: "x" }, undefined),
    ).to.equal("Hello");
  });
  it("handles missing locale gracefully", async () => {
    const modifier = new TestableLocalizationModifier();
    modifier.setOptions({});

    const data = {
      en: "Hello World",
    };

    const missingValue = modifier.unlock(data, "fr");

    expect(missingValue).to.equal(undefined);
  });
});

describe("Modifiers - localization", () => {
  it("provides localize method through mixin", async () => {
    const TestTableWithMixin = Table.with(LocalizationModifier);

    class TestTable extends TestTableWithMixin {
      @Localized({ fallbackLocale: "en" })
      @Field("string")
      declare title: string;

      @Localized({ fallbackLocale: "en" })
      @Field("string")
      declare description: string;
    }

    const instance = new TestTable();

    expect(instance).to.have.property("localize").that.is.a("function");
    expect(instance.localize("fr")).to.equal(instance);
  });
  it("handles localization decorator", async () => {
    class TestTable extends Table.with(LocalizationModifier) {
      @Localized({ fallbackLocale: "en" })
      @Field("string")
      declare title: string;

      @Localized({ fallbackLocale: "fr" })
      @Field("string")
      declare description: string;
    }

    const instance = new TestTable();

    instance.localize("fr");
    instance.title = "French Title";
    instance.description = "French Description";

    instance.localize("en").title = "English Title";
    instance.localize("en").description = "English Description";

    instance.localize("be");
    expect(instance.title).to.equal("English Title");
    expect(instance.description).to.equal("French Description");
  });
  it("localizes specific fields", async () => {
    const TestTableWithMixin = Table.with(LocalizationModifier);

    class TestTable extends TestTableWithMixin {
      @Localized({ fallbackLocale: "en" })
      @Field("string")
      declare title: string;

      @Localized({ fallbackLocale: "en" })
      @Field("string")
      declare description: string;

      @Localized({ fallbackLocale: "en" })
      @Field("string")
      declare content: string;
    }

    const instance = new TestTable();

    instance.localize("en");
    instance.title = "English Title";
    instance.description = "English Description";
    instance.content = "English Content";

    instance.localize("fr");
    instance.title = "French Title";
    instance.description = "French Description";
    instance.content = "French Content";

    instance.localize("en");
    instance.localize("fr", ["title", "content"]);

    expect(instance.title).to.equal("French Title");
    expect(instance.content).to.equal("French Content");
    expect(instance.description).to.equal("English Description");
  });
  it("refuses a text assigned to every locale at once", async () => {
    class Page extends Table.with(LocalizationModifier) {
      @Localized({ fallbackLocale: "en" })
      @Field("string")
      declare title: string;
    }
    const page = fromPlainData({}, Page).localize("en");
    page.title = "Hello";

    expect(() => {
      page.localize("*").title = "Bonjour";
    }).to.throw(TypeError);
    const stored = fromDatabase(toDatabase(page), Page);
    expect(stored.localize("en").title).to.equal("Hello");
    expect(stored.localize("0").title).to.equal("Hello");
  });
  it("clears every locale when no value is assigned to all of them", async () => {
    class Page extends Table.with(LocalizationModifier) {
      @Localized({ fallbackLocale: "en" })
      @Field("string")
      declare title?: string;
    }
    const unset = fromPlainData({}, Page);
    const page = fromPlainData({}, Page).localize("en");
    page.title = "Hello";

    lock(unset, LocalizationModifier, undefined, "*");
    page.localize("*").title = undefined;

    expect(toDatabase(unset)._internal?.data.title).to.deep.equal({});
    expect(page.localize("en").title).to.equal(undefined);
    expect(toDatabase(page)._internal?.data.title).to.deep.equal({});
  });
  it("maintains data structure integrity", async () => {
    const modifier = new TestableLocalizationModifier();
    modifier.setOptions({ fallbackLocale: "en" });

    const complexData = {
      en: { title: "English Title", content: "English Content" },
      fr: { title: "French Title", content: "French Content" },
    };

    const enValue = modifier.unlock(complexData, "en");
    const frValue = modifier.unlock(complexData, "fr");

    expect(enValue).to.deep.equal({
      title: "English Title",
      content: "English Content",
    });
    expect(frValue).to.deep.equal({
      title: "French Title",
      content: "French Content",
    });
  });
});

describe("Modifiers - localization wildcard key", () => {
  it("reads the listed fields under the wildcard key as texts by locale", async () => {
    class TestTable extends Table.with(LocalizationModifier) {
      @Localized({ fallbackLocale: "en" })
      @Field("string")
      declare title: string;

      @Field("string")
      declare code: string;
    }

    const LISTED = ["title"] as const;
    const instance = new TestTable();
    instance.code = "P-1";
    instance.localize("en").title = "Title";
    instance.localize("fr").title = "Titre";

    const texts = instance.localize("*", LISTED);
    const titles: Record<string, string> = texts.title;
    const code: string = texts.code;

    expect(titles).to.deep.equal({ en: "Title", fr: "Titre" });
    expect(code).to.equal("P-1");
  });
  it("reads one locale again after the wildcard key", async () => {
    class TestTable extends Table.with(LocalizationModifier) {
      @Localized({ fallbackLocale: "en" })
      @Field("string")
      declare title: string;

      @Localized({ fallbackLocale: "en" })
      @Field("string")
      declare subtitle?: string;
    }

    const instance = new TestTable();
    instance.localize("en").title = "Title";

    const texts = instance.localize("*", ["title", "subtitle"]);
    const subtitles: Record<string, string> | undefined = texts.subtitle;
    const title: string = texts.localize("en").title;

    expect(subtitles).to.equal(undefined);
    expect(title).to.equal("Title");
  });
  it("keeps the methods callable under the wildcard key for a list of any keys", async () => {
    class TestTable extends Table.with(LocalizationModifier, HashModifier) {
      @Localized({ fallbackLocale: "en" })
      @Field("string")
      declare title: string;

      @Hashed({ algorithm: "sha256" })
      @Field("string")
      declare fingerprint: string;
    }

    const anyKeys: Array<keyof TestTable> = ["title", "isHashOutdated"];
    const instance = new TestTable();
    instance.localize("en").title = "Title";
    instance.fingerprint = "print";

    const texts = instance.localize("*", anyKeys);
    const titles = { ...texts.title };
    const outdated: boolean = texts.isHashOutdated("fingerprint");
    const row: TestTable = texts.localize("en");

    expect(titles).to.deep.equal({ en: "Title" });
    expect(outdated).to.equal(false);
    expect(row.title).to.equal("Title");
  });
  it("reads the wildcard key as texts by locale through a generic row", async () => {
    class TestTable extends Table.with(LocalizationModifier) {
      @Localized({ fallbackLocale: "en" })
      @Field("string")
      declare title: string;

      titles() {
        return this.localize("*", ["title"]).title;
      }
    }
    function withTitles<R extends TestTable>(
      row: R,
    ): [R, Record<string, string>] {
      return [row, row.localize("*", ["title"]).title];
    }

    const instance = new TestTable();
    instance.localize("en").title = "Title";
    const own: Record<string, string> = instance.titles();

    expect(own).to.deep.equal({ en: "Title" });
    expect(withTitles(instance)[1]).to.deep.equal({ en: "Title" });
  });
});

interface LocalizationOptions {
  fallbackLocale?: string;
}

class TestableLocalizationModifier extends LocalizationModifier {
  public setOptions(options: LocalizationOptions) {
    this.options = options;
  }

  public getOptions(): LocalizationOptions {
    return this.options;
  }
}
