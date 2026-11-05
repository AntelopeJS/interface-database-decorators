import type { VerifyConfig } from "@antelopejs/tooling-configs/verify";

import { CUSTOM_JOURNEYS } from "./scenarios/custom.ts";
import { DECLARATION_JOURNEYS } from "./scenarios/declarations.ts";
import { DECORATION_JOURNEYS } from "./scenarios/decoration.ts";
import { ENCRYPTION_JOURNEYS } from "./scenarios/encryption.ts";
import { HASH_JOURNEYS } from "./scenarios/hashing.ts";
import { AUTODATE_JOURNEYS, LOCALIZATION_JOURNEYS } from "./scenarios/localization.ts";
import { MODEL_JOURNEYS } from "./scenarios/models.ts";
import { REGISTRATION_JOURNEYS } from "./scenarios/registration.ts";
import { TABLE_JOURNEYS } from "./scenarios/tables.ts";

const config: VerifyConfig = {
  services: {
    mongo: {
      image: "mongo:7",
      port: 27017,
      ready: ["mongosh", "--quiet", "--eval", "db.adminCommand('ping').ok"],
      reset: ["mongosh", "--quiet", "--eval", 'db.getSiblingDB("verify").dropDatabase()'],
    },
  },
  doors: {
    data: {
      globs: ["src/model.ts", "src/database.ts"],
      funnels: [],
      why: "model.insert, update and delete and RegisterSchema's fixtures write and remove rows in the consumer's database",
    },
    format: {
      globs: ["src/modifiers/encryption.ts", "src/modifiers/hash.ts", "src/modifiers/localization.ts", "src/modifiers/internal/records.ts"],
      funnels: [],
      why: "the encrypted [ciphertext, iv, authTag] triple, the scrypt string with its ln, r and p cost, salt and key, the digest and salt and the per-locale record are what rows persist as",
    },
    contract: {
      globs: ["src/index.ts", "package.json"],
      funnels: [],
      why: "the exports and subpaths are what every module declaring tables imports",
    },
    outbound: null,
    exposure: null,
    publish: {
      globs: ["package.json", ".release-it.json", "changelogen.config.json", ".github/workflows/release.yml"],
      funnels: [],
      why: "the package name and release workflow claim @antelopejs/interface-database-decorators on npm",
    },
  },
  journeys: { ...TABLE_JOURNEYS, ...REGISTRATION_JOURNEYS, ...MODEL_JOURNEYS, ...DECORATION_JOURNEYS, ...ENCRYPTION_JOURNEYS, ...HASH_JOURNEYS, ...LOCALIZATION_JOURNEYS, ...AUTODATE_JOURNEYS, ...CUSTOM_JOURNEYS, ...DECLARATION_JOURNEYS },
};

export default config;
