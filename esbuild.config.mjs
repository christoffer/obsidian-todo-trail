import esbuild from "esbuild";

const watch = process.argv.includes("--watch");

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "@codemirror/state", "@codemirror/view"],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: "inline",
  outfile: "main.js",
});

if (watch) {
  await context.watch();
} else {
  await context.rebuild();
  process.exit(0);
}
