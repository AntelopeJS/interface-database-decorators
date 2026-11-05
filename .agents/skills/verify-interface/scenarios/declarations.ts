import { existsSync, mkdirSync, readdirSync, readFileSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";

import { equal } from "@antelopejs/tooling-configs/verify";
import type { Journey } from "@antelopejs/tooling-configs/verify";
import { REJECT_PRELUDE, REJECTED } from "./declarations-rejected.ts";
import { MODEL_SIGNATURES, MODIFIER_SIGNATURES, PROBE_HEADER } from "./declarations-signatures.ts";

function rejected(title: string, statements: string[]): Journey {
  return {
    title,
    entryPoint: "a TypeScript consumer compiling wrong calls against the packed declarations",
    async run(context) {
      const file = `${context.work}/reject.ts`;
      const head = `import * as Api from "${context.repo}/dist/index";\n${PROBE_HEADER}\n${REJECT_PRELUDE}`;
      const firstLine = head.split("\n").length + 1;
      context.edit("write the rejecting probe", file, `${head}\n${statements.join("\n")}\n`);
      const compiled = await context.command("compile the rejecting probe", "node", [
        `${context.repo}/node_modules/typescript/bin/tsc`,
        "--noEmit",
        "--strict",
        "--skipLibCheck",
        "--experimentalDecorators",
        "--target",
        "es2022",
        "--module",
        "commonjs",
        "--moduleResolution",
        "node",
        "--typeRoots",
        `${context.repo}/node_modules/@types`,
        "--types",
        "node",
        file,
      ]);
      const failing = new Set([...compiled.stdout.matchAll(/reject\.ts\((\d+),/g)].map((match) => Number(match[1])));
      const accepted = statements.filter((_, index) => !failing.has(firstLine + index));
      context.expect(compiled.folder, [
        { name: "tsc refuses every wrong call", pass: accepted.length === 0, detail: accepted.join(" | ") },
      ]);
    },
  };
}

function declared(title: string, probe: string): Journey {
  return {
    title,
    entryPoint: "a TypeScript consumer compiling against the packed declarations",
    async run(context) {
      const file = `${context.work}/probe.ts`;
      context.edit("write the signature probe", file, `import * as Api from "${context.repo}/dist/index";\nimport type * as Db from "${context.repo}/node_modules/@antelopejs/interface-database";\n${PROBE_HEADER}\n${probe}`);
      const compiled = await context.command("compile the signature probe", "node", [
        `${context.repo}/node_modules/typescript/bin/tsc`,
        "--noEmit",
        "--strict",
        "--skipLibCheck",
        "--experimentalDecorators",
        "--target",
        "es2022",
        "--module",
        "commonjs",
        "--moduleResolution",
        "node",
        "--typeRoots",
        `${context.repo}/node_modules/@types`,
        "--types",
        "node",
        file,
      ]);
      context.expect(compiled.folder, [
        { name: "every export has the documented signature", pass: compiled.exitCode === 0, detail: compiled.stdout.slice(0, 600) },
      ]);
    },
  };
}

const PACKED_CHECK = `
const fs = require("node:fs");
const path = require("node:path");
const pack = process.argv[2];
const consumer = process.argv[3];
const skill = fs.readFileSync(path.join(pack, "skills", "database-decorators-interface", "SKILL.md"), "utf8");
const name = "@antelopejs/interface-database-decorators";
const result = { files: ["docs/1.introduction.md", "docs/5.parameter-decoration.md", "skills/database-decorators-interface/SKILL.md", "dist/index.js"].filter((file) => !fs.existsSync(path.join(pack, file))), imports: {} };
const wanted = new Map();
for (const match of skill.matchAll(/import \\{([^}]*)\\} from "(@antelopejs\\/interface-database-decorators[^"]*)"/g)) {
  const names = match[1].split(",").map((entry) => entry.trim()).filter(Boolean);
  wanted.set(match[2], [...(wanted.get(match[2]) ?? []), ...names]);
}
const requireFrom = require("node:module").createRequire(path.join(consumer, "index.js"));
for (const [specifier, names] of wanted) {
  try {
    const loaded = requireFrom(specifier);
    result.imports[specifier] = names.filter((entry) => loaded[entry] === undefined);
  } catch (error) {
    result.imports[specifier] = "ERR " + error.code;
  }
}
console.log("RESULT " + JSON.stringify({ subpaths: [...wanted.keys()].sort(), files: result.files, imports: result.imports }));
`;

/** The folder `new` packed and extracted: the nearest ancestor of the journey folder that holds `pack/package`. */
function packedPackage(work: string): string {
  let folder = work;
  while (!existsSync(join(folder, "pack", "package", "package.json"))) {
    const parent = dirname(folder);
    if (parent === folder) throw new Error(`no packed package above ${work}`);
    folder = parent;
  }
  return join(folder, "pack", "package");
}

const packedSubpaths: Journey = {
  title: "the packed package ships its docs and skill, and every subpath its skill file imports from exports the names the skill shows",
  entryPoint: "a consumer resolving the packed tarball's exports, as npm would publish them",
  async run(context) {
    const pack = packedPackage(context.work);
    const consumer = join(context.work, "consumer");
    const scope = join(consumer, "node_modules", "@antelopejs");
    mkdirSync(scope, { recursive: true });
    symlinkSync(pack, join(scope, "interface-database-decorators"), "dir");
    if (!existsSync(join(pack, "node_modules"))) symlinkSync(join(context.repo, "node_modules"), join(pack, "node_modules"), "dir");
    const script = join(context.work, "packed-check.cjs");
    context.edit("write the packed check", script, PACKED_CHECK);
    const ran = await context.command("load every subpath of the skill's imports", "node", [script, pack, consumer]);
    const line = ran.stdout.split("\n").find((entry) => entry.startsWith("RESULT "));
    context.expect(ran.folder, [
      { name: "the check ended cleanly", pass: ran.exitCode === 0, detail: ran.stderr.slice(-300) },
      equal("the packed package carries what the skill imports", line?.slice("RESULT ".length) ?? "", "{\"subpaths\":[\"@antelopejs/interface-database-decorators/common\",\"@antelopejs/interface-database-decorators/database\",\"@antelopejs/interface-database-decorators/model\",\"@antelopejs/interface-database-decorators/modifiers/autodate\",\"@antelopejs/interface-database-decorators/modifiers/common\",\"@antelopejs/interface-database-decorators/modifiers/encryption\",\"@antelopejs/interface-database-decorators/modifiers/hash\",\"@antelopejs/interface-database-decorators/modifiers/localization\",\"@antelopejs/interface-database-decorators/relation\",\"@antelopejs/interface-database-decorators/schema\",\"@antelopejs/interface-database-decorators/table\"],\"files\":[],\"imports\":{\"@antelopejs/interface-database-decorators/table\":[],\"@antelopejs/interface-database-decorators/schema\":[],\"@antelopejs/interface-database-decorators/database\":[],\"@antelopejs/interface-database-decorators/model\":[],\"@antelopejs/interface-database-decorators/relation\":[],\"@antelopejs/interface-database-decorators/common\":[],\"@antelopejs/interface-database-decorators/modifiers/autodate\":[],\"@antelopejs/interface-database-decorators/modifiers/encryption\":[],\"@antelopejs/interface-database-decorators/modifiers/hash\":[],\"@antelopejs/interface-database-decorators/modifiers/localization\":[],\"@antelopejs/interface-database-decorators/modifiers/common\":[]}}"),
    ]);
  },
};

/** Every complete TypeScript example of the docs and README, as a reader copies it; `fragment` blocks are partial by design and skipped. */
function docExamples(repo: string): { name: string; source: string }[] {
  const pages = [...readdirSync(join(repo, "docs")).filter((page) => page.endsWith(".md")).sort().map((page) => join("docs", page)), "README.md"];
  const examples: { name: string; source: string }[] = [];
  for (const page of pages) {
    const text = readFileSync(join(repo, page), "utf8");
    for (const match of text.matchAll(/^```(?:typescript|ts)([^\n]*)\n([\s\S]*?)^```/gm)) {
      if (match[1].includes("fragment")) continue;
      const line = text.slice(0, match.index).split("\n").length;
      examples.push({ name: `${page.replace(/[/.]/g, "_")}_L${line}`, source: `${match[2]}\nexport {};\n` });
    }
  }
  return examples;
}

const docsExamples: Journey = {
  title: "every complete TypeScript example in the docs and README compiles against the packed declarations",
  entryPoint: "a TypeScript consumer pasting each documented example into a module that depends on the packed package",
  async run(context) {
    const pack = packedPackage(context.work);
    const folder = join(context.work, "examples");
    mkdirSync(folder, { recursive: true });
    symlinkSync(join(context.repo, "node_modules"), join(folder, "node_modules"), "dir");
    const examples = docExamples(context.repo);
    for (const example of examples) context.edit(`write ${example.name}`, join(folder, `${example.name}.ts`), example.source);
    const tsconfig = {
      compilerOptions: {
        strict: true, noImplicitAny: false, skipLibCheck: true, experimentalDecorators: true, noEmit: true,
        target: "es2022", module: "esnext", moduleResolution: "bundler", types: ["node"],
        paths: { "@antelopejs/interface-database-decorators": [`${pack}/dist/index`], "@antelopejs/interface-database-decorators/*": [`${pack}/dist/*`] },
      },
      files: examples.map((example) => `${example.name}.ts`),
    };
    context.edit("write the consumer tsconfig", join(folder, "tsconfig.json"), `${JSON.stringify(tsconfig, null, 2)}\n`);
    const compiled = await context.command("compile every documented example", "node", [`${context.repo}/node_modules/typescript/bin/tsc`, "-p", folder], { cwd: folder });
    const failing = [...new Set([...compiled.stdout.matchAll(/^([\w.-]+)\.ts\(/gm)].map((match) => match[1]))];
    context.expect(compiled.folder, [
      { name: "the docs hold complete examples to compile", pass: examples.length >= 20, detail: examples.map((example) => example.name).join(" ") },
      { name: "every documented example compiles", pass: compiled.exitCode === 0 && failing.length === 0, detail: `${failing.join(" ")}\n${compiled.stdout.slice(0, 1500)}` },
    ]);
  },
};

export const DECLARATION_JOURNEYS = {
  "docs-examples": docsExamples,
  "model-signatures": declared("the model methods and RegisterSchema declare the return types the docs table lists", MODEL_SIGNATURES),
  "packed-subpaths": packedSubpaths,
  "rejected-calls": rejected("calls with a wrong parameter type or a missing key are refused by the declarations", REJECTED),
  "modifier-signatures": declared("the hash and localization mixins declare the return types the docs describe", MODIFIER_SIGNATURES),
} satisfies { [id: string]: Journey };
