import type { Journey } from "@antelopejs/tooling-configs/verify";

import { scenario } from "../runner.ts";

/** The helpers the HTTP scenarios share: a controller class whose routes are decorated by hand, and a fetch that answers the status and body. */
const HTTP = `
  const api = require(require.resolve("@antelopejs/interface-api", { paths: [dist] }));
  const base = "http://127.0.0.1:" + process.env.VERIFY_API_PORT;
  const route = (Controller, method, verb, path, handler, params) => {
    Controller.prototype[method] = handler;
    params.forEach((apply, index) => apply(Controller.prototype, method, index));
    api[verb](path)(Controller.prototype, method, Object.getOwnPropertyDescriptor(Controller.prototype, method));
  };
  const call = async (path, init) => { const response = await fetch(base + path, init); const text = await response.text(); return { status: response.status, body: text }; };
  class Note extends d.Table {}
  decorate(Note, { title: [d.Field("string")] });
  d.RegisterTable("notes", "http")(Note);
  await d.RegisterSchema("http");
  const NoteModel = d.BasicDataModel(Note);
`;

const FIXED = `${HTTP}
  const seen = [];
  class Fixed extends api.Controller("/fixed") {}
  route(Fixed, "list", "Get", "/", async (model) => { seen.push(model); return (await model.getAll()).map((row) => row.title); }, [d.Model(NoteModel, "main")]);
  const seenDefault = [];
  route(Fixed, "plain", "Get", "/plain", async (model) => { seenDefault.push(model); return (await model.getAll()).map((row) => row.title); }, [d.Model(NoteModel)]);
  await d.GetModel(NoteModel, "main").insert({ title: "in main" });
  await d.GetModel(NoteModel).insert({ title: "in default" });
  const plain = await call("/fixed/plain");
  await call("/fixed/plain");
  const first = await call("/fixed");
  const second = await call("/fixed");
  return { plain, defaultIsGetModel: [seenDefault.length, seenDefault[0] === d.GetModel(NoteModel), seenDefault[0] === seenDefault[1], seenDefault[0] === d.GetModel(NoteModel, "main")], first, second, sameModelEveryRequest: seen.length === 2 && seen[0] === seen[1], isTheCachedModel: seen[0] === d.GetModel(NoteModel, "main") };
`;

const PER_REQUEST = `${HTTP}
  class Tenants extends api.Controller("/tenants") {}
  route(Tenants, "list", "Get", "/:tenantId/notes", async (tenantId, model) => ({ tenantId, titles: (await model.getAll()).map((row) => row.title) }), [api.Parameter("tenantId"), d.Model(NoteModel, (ctx) => "tenant-" + ctx.routeParameters.tenantId)]);
  class Defaulted extends api.Controller("/defaulted") {}
  route(Defaulted, "list", "Get", "/", async (model) => (await model.getAll()).map((row) => row.title), [d.Model(NoteModel, () => undefined)]);
  await d.GetModel(NoteModel, "tenant-a").insert({ title: "alpha" });
  await d.GetModel(NoteModel, "tenant-b").insert({ title: "beta" });
  await d.GetModel(NoteModel).insert({ title: "default instance" });
  return { a: await call("/tenants/a/notes"), b: await call("/tenants/b/notes"), none: await call("/tenants/c/notes"), defaulted: await call("/defaulted") };
`;

const PROPERTY = `${HTTP}
  class Props extends api.Controller("/props") {}
  d.Model(NoteModel, "main")(Props.prototype, "notes");
  route(Props, "list", "Get", "/", async function () { return (await this.notes.getAll()).map((row) => row.title); }, []);
  route(Props, "one", "Get", "/:id", async function (id) { const row = await this.notes.get(id); return row ? row.title : "missing"; }, [api.Parameter("id")]);
  route(Props, "same", "Get", "/same/model", async function () { return this.notes === d.GetModel(NoteModel, "main"); }, []);
  const [id] = await d.GetModel(NoteModel, "main").insert({ title: "stored" });
  return { list: await call("/props"), one: await call("/props/" + id), missing: await call("/props/none"), sameAsGetModel: await call("/props/same/model"), outsideARequest: new Props().notes === undefined };
`;

const CRUD_CONTROLLER = `${HTTP}
  class Notes extends api.Controller("/notes") {}
  route(Notes, "list", "Get", "/", async (model) => (await model.getAll()).map((row) => row.title), [d.Model(NoteModel, "main")]);
  route(Notes, "get", "Get", "/:id", async (id, model) => { const row = await model.get(id); return row ? row.title : "missing"; }, [api.Parameter("id"), d.Model(NoteModel, "main")]);
  route(Notes, "create", "Post", "/", async (body, model) => model.insert(JSON.parse(body.toString())), [api.RawBody(), d.Model(NoteModel, "main")]);
  route(Notes, "update", "Put", "/:id", async (id, body, model) => model.update(id, JSON.parse(body.toString())), [api.Parameter("id"), api.RawBody(), d.Model(NoteModel, "main")]);
  route(Notes, "remove", "Delete", "/:id", async (id, model) => model.delete(id), [api.Parameter("id"), d.Model(NoteModel, "main")]);
  const created = await call("/notes", { method: "POST", body: JSON.stringify({ title: "first" }) });
  const id = JSON.parse(created.body)[0];
  const updated = await call("/notes/" + id, { method: "PUT", body: JSON.stringify({ title: "renamed" }) });
  const read = await call("/notes/" + id);
  const removed = await call("/notes/" + id, { method: "DELETE" });
  const gone = await call("/notes/" + id);
  return { created: [created.status, typeof id], updated, read, removed, gone };
`;

const CUSTOM_PROVIDER = `${HTTP}
  const { MakeParameterAndPropertyDecorator } = require(require.resolve("@antelopejs/interface-core/decorators", { paths: [dist] }));
  const CustomModel = MakeParameterAndPropertyDecorator((target, key, index, modelClass, resolver) => {
    api.SetParameterProvider(target, key, index, (ctx) => d.GetModel(modelClass, resolver(ctx)));
  });
  class Custom extends api.Controller("/custom") {}
  route(Custom, "list", "Get", "/:tenant", async (model) => (await model.getAll()).map((row) => row.title), [CustomModel(NoteModel, (ctx) => "c-" + ctx.routeParameters.tenant)]);
  await d.GetModel(NoteModel, "c-x").insert({ title: "custom x" });
  return { x: await call("/custom/x"), y: await call("/custom/y") };
`;

export const DECORATION_JOURNEYS = {
  "fixed-instance": scenario({
    title: "@Model with an instance id injects the cached model of that instance into a controller method",
    body: FIXED,
    printed: "{\"plain\":{\"status\":200,\"body\":\"[\\\"in default\\\"]\"},\"defaultIsGetModel\":[2,true,true,false],\"first\":{\"status\":200,\"body\":\"[\\\"in main\\\"]\"},\"second\":{\"status\":200,\"body\":\"[\\\"in main\\\"]\"},\"sameModelEveryRequest\":true,\"isTheCachedModel\":true}",
    api: true,
    stored: [{ name: "the notes by instance", expression: "$DB.getCollection('http__notes').find().sort({ title: 1 }).toArray().map((r) => [r.title, r._instance])", expected: "[[\"in default\",null],[\"in main\",\"main\"]]" }],
  }),
  "per-request-instance": scenario({
    title: "@Model with a callback picks the instance from each request, or the default instance",
    body: PER_REQUEST,
    printed: "{\"a\":{\"status\":200,\"body\":\"{\\\"tenantId\\\":\\\"a\\\",\\\"titles\\\":[\\\"alpha\\\"]}\"},\"b\":{\"status\":200,\"body\":\"{\\\"tenantId\\\":\\\"b\\\",\\\"titles\\\":[\\\"beta\\\"]}\"},\"none\":{\"status\":200,\"body\":\"{\\\"tenantId\\\":\\\"c\\\",\\\"titles\\\":[]}\"},\"defaulted\":{\"status\":200,\"body\":\"[\\\"default instance\\\"]\"}}",
    api: true,
    stored: [{ name: "the notes by instance", expression: "$DB.getCollection('http__notes').find().sort({ title: 1 }).toArray().map((r) => [r.title, r._instance])", expected: "[[\"alpha\",\"tenant-a\"],[\"beta\",\"tenant-b\"],[\"default instance\",null]]" }],
  }),
  "custom-parameter-provider": scenario({ title: "a custom decorator can register its own parameter provider that resolves a model with GetModel", body: CUSTOM_PROVIDER, printed: "{\"x\":{\"status\":200,\"body\":\"[\\\"custom x\\\"]\"},\"y\":{\"status\":200,\"body\":\"[]\"}}", api: true }),
  "property-decoration": scenario({
    title: "@Model on a property gives the controller its model while a request is handled",
    body: PROPERTY,
    printed: "{\"list\":{\"status\":200,\"body\":\"[\\\"stored\\\"]\"},\"one\":{\"status\":200,\"body\":\"stored\"},\"missing\":{\"status\":200,\"body\":\"missing\"},\"sameAsGetModel\":{\"status\":200,\"body\":\"true\"},\"outsideARequest\":true}",
    api: true,
  }),
  "crud-controller": scenario({
    title: "@Model combines with the API decorators in a CRUD controller",
    body: CRUD_CONTROLLER,
    printed: "{\"created\":[200,\"string\"],\"updated\":{\"status\":200,\"body\":\"1\"},\"read\":{\"status\":200,\"body\":\"renamed\"},\"removed\":{\"status\":200,\"body\":\"1\"},\"gone\":{\"status\":200,\"body\":\"missing\"}}",
    api: true,
    stored: [{ name: "the notes left", expression: "$DB.getCollection('http__notes').find().toArray().length", expected: "0" }],
  }),
} satisfies { [id: string]: Journey };
