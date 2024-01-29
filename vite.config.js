import { fileURLToPath, URL } from "node:url";

import { defineConfig, normalizePath } from "vite";
import vue from "@vitejs/plugin-vue2";
import { VuetifyResolver } from "unplugin-vue-components/resolvers";
import Components from "unplugin-vue-components/vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import path from "node:path";

function joinAndNormalizePath(...paths) {
  return normalizePath(path.join(...paths));
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    Components({
      resolvers: [VuetifyResolver()],
    }),
    viteStaticCopy({
      targets: [
        {
          src: joinAndNormalizePath(
            __dirname,
            "node_modules",
            "itk",
            "WebWorkers",
          ),
          dest: joinAndNormalizePath("itk"),
        },
        {
          src: joinAndNormalizePath(
            __dirname,
            "node_modules",
            "itk",
            "ImageIOs",
          ),
          dest: joinAndNormalizePath("itk"),
        },
        {
          src: joinAndNormalizePath(
            __dirname,
            "node_modules",
            "itk",
            "PolyDataIOs",
          ),
          dest: joinAndNormalizePath("itk"),
        },
        {
          src: joinAndNormalizePath(
            __dirname,
            "node_modules",
            "itk",
            "MeshIOs",
          ),
          dest: joinAndNormalizePath("itk"),
        },
        {
          src: joinAndNormalizePath(
            __dirname,
            "itk",
            "web-build",
            "**",
            "*.{js,wasm}",
          ),
          dest: joinAndNormalizePath("itk", "Pipelines"),
        },
        {
          src: joinAndNormalizePath(
            __dirname,
            "node_modules",
            "onnxruntime-web",
            "dist",
            "*.wasm",
          ),
          dest: joinAndNormalizePath("onnx-wasm"),
        },
      ],
    }),
  ],
  // css: {
  //   preprocessorOptions: {
  //     sass: {
  //       additionalData: '@import "@/style.scss"\n',
  //     },
  //   },
  // },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    minify: false, // TODO: use minification
  },
});
