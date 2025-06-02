"use strict";
const path = require("path");
const {
  webpack,
  createWebConfig,
  merge,
} = require("@mongodb-js/webpack-config-compass");
const CopyPlugin = require("copy-webpack-plugin");

function localPolyfill(name, from_compass = true) {
  if (from_compass) {
    return path.resolve(
      __dirname,
      "compass",
      "packages",
      "compass-web",
      "polyfills",
      ...name.split("/"),
      "index.ts"
    );
  }
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
        "@mongodb-js/devtools-proxy-support/proxy-options": require.resolve(
          "@mongodb-js/devtools-proxy-support/proxy-options"
        ),
        "@mongodb-js/devtools-proxy-support": localPolyfill(
          "@mongodb-js/devtools-proxy-support"
        ),
        "@mongodb-js/devtools-connect": localPolyfill(
          "@mongodb-js/devtools-connect"
        ),
        "@mongodb-js/oidc-plugin": false,

        "@emotion/server/create-instance": path.resolve(
          __dirname,
          ..."compass/configs/webpack-config-compass/polyfills/@emotion/server/create-instance/index.js".split(
            "/"
          )
        ),
        "fs/promises": localPolyfill("fs/promises"),
        fs: localPolyfill("fs"),
        "timers/promises": require.resolve("timers-browserify"),
        timers: require.resolve("timers-browserify"),
        net: localPolyfill("net", false),
        zlib: localPolyfill("zlib"),
        tls: localPolyfill("tls"),
        dns: localPolyfill("dns"),
        net: localPolyfill("net", false),
        stream: require.resolve("readable-stream"),
        buffer: require.resolve("buffer/"),
        url: require.resolve("whatwg-url"),
        path: require.resolve("path-browserify"),
        crypto: require.resolve("crypto-browserify"),
        os: require.resolve("os-browserify"),
        vm: require.resolve("vm-browserify"),
        "util/types": localPolyfill("util/types"),
        util: require.resolve("util/"),
        http: false,
        child_process: false,
        v8: false,
        electron: false,
        "hadron-ipc": false,
        worker_threads: false,
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
        Buffer: ["buffer", "Buffer"],
        process: [localPolyfill("process"), "process"],
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
