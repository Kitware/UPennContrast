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
            from: path.join(__dirname, "itk", "web-build", "Max", "Max.js"),
            to: path.join(__dirname, "dist", "itk", "Pipelines", "Max.js")
          },
          {
            from: path.join(__dirname, "itk", "web-build", "Max", "MaxWasm.js"),
            to: path.join(__dirname, "dist", "itk", "Pipelines", "MaxWasm.js")
          },
          {
            from: path.join(
              __dirname,
              "itk",
              "web-build",
              "Max",
              "MaxWasm.wasm"
            ),
            to: path.join(__dirname, "dist", "itk", "Pipelines", "MaxWasm.wasm")
          },
          {
            from: path.join(
              __dirname,
              "itk",
              "web-build",
              "Threshold",
              "Threshold.js"
            ),
            to: path.join(__dirname, "dist", "itk", "Pipelines", "Threshold.js")
          },
          {
            from: path.join(
              __dirname,
              "itk",
              "web-build",
              "Threshold",
              "ThresholdWasm.js"
            ),
            to: path.join(
              __dirname,
              "dist",
              "itk",
              "Pipelines",
              "ThresholdWasm.js"
            )
          },
          {
            from: path.join(
              __dirname,
              "itk",
              "web-build",
              "Threshold",
              "ThresholdWasm.wasm"
            ),
            to: path.join(
              __dirname,
              "dist",
              "itk",
              "Pipelines",
              "ThresholdWasm.wasm"
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
    disableHostCheck: true
  }
};
