import { expect } from "chai";

import { BasicDataModel } from "../model";
import { LocalizationModifier, Localized } from "../modifiers/localization";
import { fromDatabase, toDatabase, toPlainData } from "../modifiers/common";
import { Field, Table } from "../table";

class Article extends Table.with(LocalizationModifier) {
  @Localized({ fallbackLocale: "en" })
  declare title: string;

  @Field("number")
  declare views: number;
}

const ArticleModel = BasicDataModel(Article, "articles");

describe("Row forms", () => {
  it("reads a localized field given per locale", () => {
    const article = ArticleModel.fromPlainData({
      title: { en: "Hello", fr: "Salut" },
    }).localize("*");

    expect(article.localize("fr").title).to.equal("Salut");
    expect(article.localize("en").title).to.equal("Hello");
  });

  it("locks a value given in the plain form once its locale is known", () => {
    const article = ArticleModel.fromPlainData({
      title: "Bonjour",
      views: 2,
    }).localize("fr");

    expect(
      ArticleModel.toDatabase(article)._internal?.data.title,
    ).to.deep.equal({ fr: "Bonjour" });
  });

  it("leaves the locked fields out of the plain form", () => {
    const article = ArticleModel.fromPlainData({ title: "Hi" }).localize("en");

    const plain = toPlainData(article);

    expect(plain).to.deep.equal({ title: "Hi" });
  });

  it("gives back a stored row as an instance of its table", () => {
    const written = ArticleModel.fromPlainData({
      title: "Hi",
      views: 3,
    }).localize("en");

    const read = fromDatabase(toDatabase(written), Article);

    expect(read).to.be.instanceOf(Article);
    expect(read.views).to.equal(3);
    expect(read.localize("en").title).to.equal("Hi");
  });
});
