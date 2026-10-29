import Module from "node:module";
import { realpathSync } from "node:fs";
import path from "node:path";

interface ModuleInternals {
  _resolveFilename(request: string, parent: Module): string;
  _nodeModulePaths(directory: string): string[];
}

interface LoadableModule {
  load(filename: string): void;
}

type ModuleRequire = (request: string) => object;

function hasInternals(
  candidate: typeof Module,
): candidate is typeof Module & ModuleInternals {
  return (
    "_resolveFilename" in candidate &&
    typeof candidate._resolveFilename === "function" &&
    "_nodeModulePaths" in candidate &&
    typeof candidate._nodeModulePaths === "function"
  );
}

function isLoadable(candidate: Module): candidate is Module & LoadableModule {
  return "load" in candidate && typeof candidate.load === "function";
}

function isModuleExports(value: unknown): value is object {
  return (
    (typeof value === "object" || typeof value === "function") && value !== null
  );
}

function exportsOf(loaded: Module): object {
  const exported = loaded.exports;
  if (!isModuleExports(exported)) {
    throw new Error(
      `${loaded.filename} does not export an object or a function`,
    );
  }
  return exported;
}

function resolveInternals() {
  if (!hasInternals(Module)) {
    throw new Error("node:module does not expose its resolution internals");
  }
  return Module;
}

/**
 * Evaluates built packages a second time, the way the core gives each
 * provider binding its own copy of an interface: every file under `folders`
 * is loaded again, with its own classes, symbols and registries, while
 * anything else (interface-core, third-party dependencies) stays the copy
 * already loaded.
 *
 * @param folders Build output folders to evaluate again
 * @returns A `require` resolving into the second copy
 */
export function CreateOtherInstance(folders: string[]): ModuleRequire {
  const owned = folders.map((folder) => realpathSync(folder) + path.sep);
  const modules = new Map<string, Module>();

  const load = (filename: string, parent: Module): object => {
    const cached = modules.get(filename);
    if (cached) {
      return exportsOf(cached);
    }
    const loaded = new Module(filename, parent);
    loaded.filename = filename;
    loaded.paths = resolveInternals()._nodeModulePaths(path.dirname(filename));
    loaded.require = (request: string) => requireFrom(loaded, request);
    modules.set(filename, loaded);
    if (!isLoadable(loaded)) {
      throw new Error("node:module instances cannot load a file directly");
    }
    loaded.load(filename);
    return exportsOf(loaded);
  };

  const requireFrom = (parent: Module, request: string): object => {
    const filename = resolveInternals()._resolveFilename(request, parent);
    const isOwned = owned.some((root) => filename.startsWith(root));
    if (isOwned) {
      return load(filename, parent);
    }
    const required = Module.prototype.require.call(parent, request);
    if (!isModuleExports(required)) {
      throw new Error(`${request} does not export an object or a function`);
    }
    return required;
  };

  return (request: string) => requireFrom(module, request);
}
