import { MongoMemoryServer } from "mongodb-memory-server-core";
import { defineConfig } from "@antelopejs/interface-core/config";
import { ApiPort } from "./tests/helpers/api-port";

let mongod: MongoMemoryServer;
const apiPort = ApiPort();

export default defineConfig({
  name: "interface-database-decorators-test",
  cacheFolder: ".antelope/cache",
  modules: {
    local: {
      source: { type: "local", path: "." },
    },
    mongodb: {
      source: {
        type: "package",
        package: "@antelopejs/mongodb",
        version: "1.7.0",
      },
    },
    api: {
      source: {
        type: "package",
        package: "@antelopejs/api",
        version: "1.6.0",
      },
      config: {
        servers: [{ protocol: "http", host: "127.0.0.1", port: apiPort }],
        publicBaseUrl: `http://127.0.0.1:${apiPort}`,
      },
    },
  },
  test: {
    folder: "dist/tests",
    async setup() {
      mongod = await MongoMemoryServer.create();
      return {
        modules: {
          mongodb: {
            config: { url: mongod.getUri(), database: "antelopejs_test" },
          },
        },
      };
    },
    async cleanup() {
      await mongod.stop();
    },
  },
});
