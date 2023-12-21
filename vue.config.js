const CopyPlugin = require("copy-webpack-plugin");
const path = require("path");
module.exports = {
  transpileDependencies: ["vuex-module-decorators", "vuetify"],
  configureWebpack: {
    plugins: [
      new CopyPlugin({
        patterns: [
          {
            from: path.join(__dirname, "node_modules", "itk", "WebWorkers"),
            to: path.join(__dirname, "dist", "itk", "WebWorkers")
          },
          {
            from: path.join(__dirname, "node_modules", "itk", "ImageIOs"),
            to: path.join(__dirname, "dist", "itk", "ImageIOs")
          },
          {
            from: path.join(__dirname, "node_modules", "itk", "PolyDataIOs"),
            to: path.join(__dirname, "dist", "itk", "PolyDataIOs")
          },
          {
            from: path.join(__dirname, "node_modules", "itk", "MeshIOs"),
            to: path.join(__dirname, "dist", "itk", "MeshIOs")
          },
          {
            from: path.join(
              __dirname,
              "itk",
              "web-build",
              "BlobToDotMax",
              "BlobToDotMax.js"
            ),
            to: path.join(
              __dirname,
              "dist",
              "itk",
              "Pipelines",
              "BlobToDotMax.js"
            )
          },
          {
            from: path.join(
              __dirname,
              "itk",
              "web-build",
              "BlobToDotMax",
              "BlobToDotMaxWasm.js"
            ),
            to: path.join(
              __dirname,
              "dist",
              "itk",
              "Pipelines",
              "BlobToDotMaxWasm.js"
            )
          },
          {
            from: path.join(
              __dirname,
              "itk",
              "web-build",
              "BlobToDotMax",
              "BlobToDotMaxWasm.wasm"
            ),
            to: path.join(
              __dirname,
              "dist",
              "itk",
              "Pipelines",
              "BlobToDotMaxWasm.wasm"
            )
          },
          {
            from: path.join(
              __dirname,
              "itk",
              "web-build",
              "BlobToBlobThreshold",
              "BlobToBlobThreshold.js"
            ),
            to: path.join(
              __dirname,
              "dist",
              "itk",
              "Pipelines",
              "BlobToBlobThreshold.js"
            )
          },
          {
            from: path.join(
              __dirname,
              "itk",
              "web-build",
              "BlobToBlobThreshold",
              "BlobToBlobThresholdWasm.js"
            ),
            to: path.join(
              __dirname,
              "dist",
              "itk",
              "Pipelines",
              "BlobToBlobThresholdWasm.js"
            )
          },
          {
            from: path.join(
              __dirname,
              "itk",
              "web-build",
              "BlobToBlobThreshold",
              "BlobToBlobThresholdWasm.wasm"
            ),
            to: path.join(
              __dirname,
              "dist",
              "itk",
              "Pipelines",
              "BlobToBlobThresholdWasm.wasm"
            )
          },
          {
            from: path.join(
              __dirname,
              "itk",
              "web-build",
              "CircleToDotMax",
              "CircleToDotMax.js"
            ),
            to: path.join(
              __dirname,
              "dist",
              "itk",
              "Pipelines",
              "CircleToDotMax.js"
            )
          },
          {
            from: path.join(
              __dirname,
              "itk",
              "web-build",
              "CircleToDotMax",
              "CircleToDotMaxWasm.js"
            ),
            to: path.join(
              __dirname,
              "dist",
              "itk",
              "Pipelines",
              "CircleToDotMaxWasm.js"
            )
          },
          {
            from: path.join(
              __dirname,
              "itk",
              "web-build",
              "CircleToDotMax",
              "CircleToDotMaxWasm.wasm"
            ),
            to: path.join(
              __dirname,
              "dist",
              "itk",
              "Pipelines",
              "CircleToDotMaxWasm.wasm"
            )
          }
        ]
      })
    ]
    // resolve: {
    //   alias: {
    //     moment: "moment/src/moment"
    //   }
    // }
  },
  devServer: {
    host: "0.0.0.0",
    hot: true,
    allowedHosts: "all"
  }
};
