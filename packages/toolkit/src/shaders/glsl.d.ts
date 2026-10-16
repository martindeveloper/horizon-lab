/** Consumers must configure their bundler to load .glsl as text. */
declare module "*.glsl" {
  const source: string;
  export default source;
}
