import { fileURLToPath } from "node:url";
import { mergeConfig, defineConfig, configDefaults } from "vitest/config";
import viteConfig from "./vite.config";

// We have to put the "@/test" alias BEFORE the "@" alias from viteConfig
// Otherwise, "@/test" is resolved to the folder "test" in the alias "@", instead of the alias "@/test"
const tweakedViteConfig = mergeConfig(
  {
    resolve: {
      alias: {
        "@/test": fileURLToPath(new URL("./test", import.meta.url)),
      },
    },
  },
  viteConfig,
);

export default mergeConfig(
  tweakedViteConfig,
  defineConfig({
    test: {
      globals: true,
      exclude: [...configDefaults.exclude, "e2e/*"],
      root: fileURLToPath(new URL("./", import.meta.url)),
    },
  }),
);
