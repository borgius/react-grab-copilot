import { defineConfig } from "vite";
import { resolve } from "path";
import { builtinModules } from "module";

export default defineConfig({
  build: {
    target: "node18",
    lib: {
      entry: resolve(__dirname, "src/extension.ts"),
      fileName: () => "extension.js",
      formats: ["cjs"],
    },
    rollupOptions: {
      external: [
        "vscode",
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
    },
    outDir: "dist",
    sourcemap: true,
    minify: false,
  },
});
