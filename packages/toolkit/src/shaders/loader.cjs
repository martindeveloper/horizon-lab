const fs = require("node:fs");
const path = require("node:path");
const { preprocessShader } = require("./preprocess.cjs");

/** Webpack-compatible build loader, also supported by Next.js Turbopack. */
module.exports = function shaderLoader(source) {
  this.cacheable?.();
  const files = new Map();
  const identify = (file) => path.relative(this.rootContext, file).split(path.sep).join("/");
  const root = fs.realpathSync(this.resourcePath);
  files.set(identify(root), root);
  const result = preprocessShader(source, {
    id: identify(root),
    resolve: (name, importer) => {
      let candidate;
      if (name.startsWith("horizon/")) {
        const snippet = name.slice("horizon/".length);
        if (!/^[\w-]+(?:\/[\w-]+)*$/.test(snippet))
          throw new Error(`Invalid shader snippet: ${name}`);
        candidate = path.join(__dirname, `${snippet}.glsl`);
      } else {
        if (!name.startsWith("./") && !name.startsWith("../"))
          throw new Error(`Shader paths must be relative: ${name}`);
        if (!name.endsWith(".glsl")) throw new Error(`Shader includes require .glsl: ${name}`);
        candidate = path.resolve(path.dirname(files.get(importer)), name);
      }
      this.addDependency(candidate);
      const file = fs.realpathSync(candidate);
      this.addDependency(file);
      const id = identify(file);
      files.set(id, file);
      return { id, source: fs.readFileSync(file, "utf8") };
    },
  });
  return `export default ${JSON.stringify(result)};`;
};
