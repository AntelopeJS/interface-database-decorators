import { mkdirSync, symlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";

import { equal } from "@antelopejs/tooling-configs/verify";
import type { Check, Journey, JourneyContext } from "@antelopejs/tooling-configs/verify";

/** The Mongo database every scenario uses, dropped before each journey by the service's `reset`. */
export const DATABASE = "verify";

/** One native read-back: a `mongosh` expression evaluated against the verify database, and the JSON it must print. */
export interface Stored {
  name: string;
  expression: string;
  expected: string;
}

/** What a scenario must print, and what the database itself must hold afterwards. */
export interface Scenario {
  title: string;
  /** Statements run inside a mocha test after the prelude; `return` the observations the docs promise. */
  body: string;
  /** The JSON the body returns. */
  printed: string;
  stored?: Stored[];
  /** Also loads `@antelopejs/api` on a free port, exposed to the body as `process.env.VERIFY_API_PORT`. */
  api?: boolean;
}

/** The helpers every scenario shares: the packed decorators, the database interface, and small helpers. */
const PRELUDE = `
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const dist = process.env.VERIFY_REPO + "/dist/index.js";
const d = require(dist);
const iface = require(require.resolve("@antelopejs/interface-database", { paths: [dist] }));
const decorate = (cls, props) => { for (const [key, list] of Object.entries(props)) for (const apply of list) apply(cls.prototype, key); return cls; };
const caught = (fn) => { try { fn(); return null; } catch (error) { return error.message; } };
const rejection = async (promise) => { try { await promise; return null; } catch (error) { return { name: error.name, message: error.message }; } };
const mongoDriver = () => require(require.resolve("mongodb", { paths: [process.env.VERIFY_MODULE_CACHE + "/@antelopejs/mongodb"] }));
const indexNames = async (collection) => { const client = new (mongoDriver().MongoClient)(process.env.VERIFY_MONGO_URL); try { await client.connect(); return (await client.db("${DATABASE}").collection(collection).indexes()).map((index) => index.name).sort(); } finally { await client.close(); } };
const untilIndexed = async (collection, names) => { for (let attempt = 0; attempt < 120; attempt += 1) { const have = await indexNames(collection); if (names.every((name) => have.includes(name))) return have; await new Promise((resolve) => setTimeout(resolve, 500)); } return null; };
const refusedDuplicate = async (model, make) => { for (let attempt = 0; attempt < 60; attempt += 1) { try { const [id] = await model.insert(make(attempt)); await model.delete(id); } catch (error) { return error; } await new Promise((resolve) => setTimeout(resolve, 500)); } return null; };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const rawTable = (schemaId, table, instance) => iface.Schema.get(schemaId).instance(instance).table(table);
`;

const TAIL = `
describe("scenario", function () {
  it("runs", async function () {
    this.timeout(120000);
    const out = await main();
    console.log("RESULT " + JSON.stringify(out, (key, value) => (value === undefined ? null : value)));
  });
});
`;

const TEST_CONFIG = `
const { defineConfig } = require(require.resolve("@antelopejs/interface-core/config", { paths: [process.env.VERIFY_REPO] }));
const modules = {
  local: { source: { type: "local", path: "." } },
  mongodb: { source: { type: "package", package: "@antelopejs/mongodb", version: "1.5.0" }, config: { url: process.env.VERIFY_MONGO_URL, database: "${DATABASE}" } },
};
if (process.env.VERIFY_API_PORT) {
  modules.api = {
    source: { type: "package", package: "@antelopejs/api", version: "1.3.0" },
    config: { servers: [{ protocol: "http", host: "127.0.0.1", port: Number(process.env.VERIFY_API_PORT) }], publicBaseUrl: "http://127.0.0.1:" + process.env.VERIFY_API_PORT },
  };
}
module.exports = defineConfig({ name: "verify-scenario", cacheFolder: process.env.VERIFY_MODULE_CACHE, modules, test: { folder: "." } });
`;

const MODULE_MANIFEST = JSON.stringify({
  name: "verify-scenario",
  version: "1.0.0",
  main: "index.js",
  antelopeJs: { test: "./antelope.test.js", standalone: true },
});

const MODULE_ENTRY = "exports.construct = () => {};\nexports.start = () => {};\nexports.stop = () => {};\nexports.destroy = () => {};\n";

/** Asks the kernel for a free loopback port. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = address instanceof Object && "port" in address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

/** Reads `mongosh` output as one compact JSON line. */
function compact(text: string): string {
  return text.trim().split("\n").at(-1) ?? "";
}

/** Runs a scenario in a real `ajs module test` with the packed decorators and a MongoDB module wired to the Docker service, then reads the database back through `mongosh`: the second view. */
export function scenario({ title, body, printed, stored = [], api = false }: Scenario): Journey {
  return {
    title,
    entryPoint: "a module test run by `ajs module test` with the decorators, @antelopejs/mongodb and a MongoDB container",
    async run(context: JourneyContext) {
      const mongo = context.service("mongo");
      const folder = join(context.work, "module");
      mkdirSync(folder, { recursive: true });
      symlinkSync(join(context.repo, "node_modules"), join(folder, "node_modules"), "dir");
      context.edit("write the module manifest", join(folder, "package.json"), `${MODULE_MANIFEST}\n`);
      context.edit("write the module entry", join(folder, "index.js"), MODULE_ENTRY);
      context.edit("write the test configuration", join(folder, "antelope.test.js"), TEST_CONFIG);
      context.edit("write the scenario", join(folder, "scenario.test.js"), `${PRELUDE}\nasync function main() {\n${body}\n}\n${TAIL}`);
      const cache = join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "antelopejs-verify", "ids-modules");
      const apiPort = api ? String(await freePort()) : "";
      const env = {
        VERIFY_REPO: context.repo,
        VERIFY_MODULE_CACHE: cache,
        VERIFY_MONGO_URL: `mongodb://${mongo.host}:${mongo.port}`,
        VERIFY_API_PORT: apiPort,
      };
      const ran = await context.command("run the scenario", join(context.repo, "node_modules", ".bin", "ajs"), ["module", "test", folder, "-f", join(folder, "scenario.test.js")], {
        cwd: folder,
        env,
        timeoutMs: 300_000,
      });
      const line = ran.stdout.split("\n").find((entry) => entry.startsWith("RESULT "));
      context.expect(ran.folder, [
        { name: "the scenario ended cleanly", pass: ran.exitCode === 0, detail: `${ran.stdout.slice(-600)}${ran.stderr.slice(-300)}` },
        equal("the scenario printed what the docs promise", line?.slice("RESULT ".length) ?? "", printed),
      ]);
      for (const read of stored) {
        const expression = `print(JSON.stringify(${read.expression.replaceAll("$DB", `db.getSiblingDB("${DATABASE}")`)}))`;
        let result = await context.native(read.name, "mongo", ["mongosh", "--quiet", "--eval", expression]);
        for (let again = 0; again < 20 && compact(result.stdout) !== read.expected; again += 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          result = await context.native(read.name, "mongo", ["mongosh", "--quiet", "--eval", expression]);
        }
        const checks: Check[] = [equal(`MongoDB holds ${read.name}`, compact(result.stdout), read.expected)];
        context.expect(result.folder, checks);
      }
    },
  };
}
