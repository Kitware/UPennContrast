module.exports = {
  transpileDependencies: ["vuex-module-decorators", "vuetify"],
  chainWebpack: (config) => {
    config.output.strictModuleExceptionHandling(true);
    config.resolve.symlinks(false);
  },
  publicPath: process.env.NODE_ENV === 'production' ? '/static/contrast' : '/',
  devServer: {
    host: "0.0.0.0",
    hot: true,
    disableHostCheck: true
  }
};
