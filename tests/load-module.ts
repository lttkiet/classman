import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const nativeRequire = createRequire(import.meta.url);

export function moduleLoader(overrides: Record<string, unknown>) {
  const cache = new Map<string, object>();
  function load<T>(path: string, suffix = ""): T {
    if (cache.has(path)) return cache.get(path) as T;
    const exports = {};
    cache.set(path, exports);
    const source = readFileSync(resolve(path), "utf8") + suffix;
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const require = (id: string): unknown => Object.hasOwn(overrides, id) ? overrides[id]
      : id.startsWith("@/") ? load(`src/${id.slice(2)}.${existsSync(`src/${id.slice(2)}.ts`) ? "ts" : "tsx"}`) : nativeRequire(id);
    runInNewContext(code, { exports, require, console, Date, Object, Set, Response, Request, Headers, Uint8Array, encodeURIComponent, process: { env: { NODE_ENV: 'test' } } });
    return exports as T;
  }
  return load;
}
