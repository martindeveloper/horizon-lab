export type ShaderSource = { id: string; source: string };
export function preprocessShader(
  source: string,
  options: { id?: string; resolve: (name: string, importer: string) => ShaderSource },
): string;
