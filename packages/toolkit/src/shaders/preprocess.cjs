/** Expand explicit includes without interpreting GLSL macros or Three.js chunks. */
function preprocessShader(source, { id = "shader", resolve }) {
  const included = new Set();
  const stack = [];
  const sources = new Map([[id, 0]]);
  function expand(text, file) {
    if (stack.includes(file))
      throw new Error(`Shader include cycle: ${[...stack, file].join(" -> ")}`);
    if (stack.length >= 64) throw new Error(`Shader include depth exceeded: ${file}`);
    if (included.has(file)) return "";
    included.add(file);
    stack.push(file);
    // Strip comments only for directive recognition, preserving source and line numbers.
    const visible = text.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (comment) =>
      comment.replace(/[^\n]/g, " "),
    );
    const lines = text.split("\n");
    let conditionalDepth = 0;
    const result = visible
      .split("\n")
      .map((line, index) => {
        if (/^\s*#\s*(if|ifdef|ifndef)\b/.test(line)) conditionalDepth++;
        if (/^\s*#\s*endif\b/.test(line)) conditionalDepth--;
        if (stack.length > 1 && /^\s*#\s*version\b/.test(line))
          throw new Error(`${file}:${index + 1}: #version belongs in the entry shader`);
        const match = line.match(/^\s*#\s*include\s+(?:<horizon\/([\w/-]+)>|"([^"\n]+)")\s*$/);
        if (!match) {
          if (/^\s*#\s*include\s+[<"](?:horizon\/|\.)/.test(line))
            throw new Error(`${file}:${index + 1}: Invalid shader include`);
          return lines[index];
        }
        if (conditionalDepth)
          throw new Error(`${file}:${index + 1}: Shader includes must be unconditional`);
        const name = match[1] ? `horizon/${match[1]}` : match[2];
        let child;
        try {
          child = resolve(name, file);
        } catch (error) {
          throw new Error(`${file}:${index + 1}: ${error.message}`, { cause: error });
        }
        if (!sources.has(child.id)) sources.set(child.id, sources.size);
        const body = expand(child.source, child.id);
        // Preserve comments around the directive, including block comments that
        // open or close on another line. Restore the include line for its suffix.
        const prefix = lines[index].slice(0, line.indexOf("#"));
        const suffix = lines[index].slice(line.trimEnd().length);
        return body
          ? `${prefix}\n#line 1 ${sources.get(child.id)}\n${body}\n#line ${index + 1} ${sources.get(file)}\n${suffix}`
          : prefix + suffix;
      })
      .join("\n");
    stack.pop();
    return result;
  }
  const output = expand(source, id);
  const legend = [...sources]
    .map(([file, number]) => `// shader source ${number}: ${file.replace(/[\r\n]/g, " ")}`)
    .join("\n");
  // Trailing comments leave an entry's #version and original line numbers intact.
  return `${output}\n${legend}\n`;
}
module.exports = { preprocessShader };
