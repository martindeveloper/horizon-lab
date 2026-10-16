import { preprocessShader } from "./preprocess.cjs";

/** In-memory adapter for tests and consumers without a build loader. */
export function assembleShader(source: string, snippets: Readonly<Record<string, string>>) {
  return preprocessShader(source, {
    resolve(name) {
      const key = name.replace(/^horizon\//, "");
      const source = snippets[key];
      if (source === undefined) throw new Error(`Missing shader snippet: ${key}`);
      return { id: name, source };
    },
  });
}
