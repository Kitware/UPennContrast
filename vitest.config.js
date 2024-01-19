import { fileURLToPath } from "node:url";
import { mergeConfig, defineConfig, configDefaults } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: "jsdom",
      exclude: [...configDefaults.exclude, "e2e/*"],
      root: fileURLToPath(new URL("./", import.meta.url)),
      alias: {
        // TODO: this doesn't work but moving this line as the first alias in vite.config.js works
        "@/test": fileURLToPath(new URL("./test", import.meta.url)),
      },
    },
  }),
);
