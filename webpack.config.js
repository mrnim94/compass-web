"use strict";
const path = require("path");
const {
  webpack,
  createWebConfig,
  merge,
} = require("@mongodb-js/webpack-config-compass");
const CopyPlugin = require("copy-webpack-plugin");
function localPolyfill(name) {
  return path.resolve(
    __dirname,
    "src",
    "polyfills",
    ...name.split("/"),
    "index.ts"
  );
}

const MAX_COMPRESSION_FILE_SIZE = 10_000_000;

module.exports = (env, args) => {
  let config = createWebConfig({
    ...args,
    mode: "development",
    entry: path.resolve(__dirname, "src", "index.tsx"),
  });

  delete config.externals;

  config = merge(config, {
    context: __dirname,
    resolve: {
      alias: {
        "@mongodb-js/compass-web": require.resolve("@mongodb-js/compass-web"),
        "@mongodb-js/compass-components": require.resolve(
          "@mongodb-js/compass-components"
        ),
        tls: localPolyfill("tls"),
        net: localPolyfill("net"),
        stream: require.resolve("readable-stream"),
        buffer: require.resolve("buffer/"),
        url: require.resolve("whatwg-url"),
      },
    },
    plugins: [
      new webpack.DefinePlugin({
        "process.env.APP_ENV": JSON.stringify("web"),
      }),
      new CopyPlugin({
        patterns: ["src/index.html"],
      }),
      new webpack.ProvidePlugin({
        // Buffer: ["buffer", "Buffer"],
        // Required by the driver to function in browser environment
        // process: [localPolyfill("process"), "process"],
      }),
    ],
    performance: {
      hints: "warning",
      maxEntrypointSize: MAX_COMPRESSION_FILE_SIZE,
      maxAssetSize: MAX_COMPRESSION_FILE_SIZE,
    },
  });

  return config;
};
