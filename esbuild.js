const esbuild = require("esbuild");

const args = process.argv.slice(2);
const isWatch = args.includes("--watch");
const isMinify = args.includes("--minify");

const baseConfig = {
  entryPoints: ["./src/extension.ts"],
  bundle: true,
  outfile: "./dist/extension.js",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  minify: isMinify,
  sourcemap: !isMinify,
  logLevel: "info",
};

async function main() {
  if (isWatch) {
    const ctx = await esbuild.context(baseConfig);
    await ctx.watch();
    console.log("watching...");
  } else {
    await esbuild.build(baseConfig);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
