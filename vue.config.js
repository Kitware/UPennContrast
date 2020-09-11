module.exports = {
  transpileDependencies: ["vuex-module-decorators", "vuetify"],
  configureWebpack: {
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
