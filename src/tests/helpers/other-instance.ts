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
  return "_resolveFilename" in candidate && "_nodeModulePaths" in candidate;
}

function isLoadable(candidate: Module): candidate is Module & LoadableModule {
  return "load" in candidate;
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
      return cached.exports;
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
    return loaded.exports;
  };

  const requireFrom = (parent: Module, request: string): object => {
    const filename = resolveInternals()._resolveFilename(request, parent);
    const isOwned = owned.some((root) => filename.startsWith(root));
    return isOwned
      ? load(filename, parent)
      : Module.prototype.require.call(parent, request);
  };

  return (request: string) => requireFrom(module, request);
}
