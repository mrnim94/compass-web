const path = require('path');
const {
  webpack,
  createWebConfig,
  merge,
} = require('@mongodb-js/webpack-config-compass');
const CopyPlugin = require('copy-webpack-plugin');

function localPolyfill(name) {
  return path.resolve(__dirname, 'polyfills', ...name.split('/'), 'index.ts');
}

/**
 * Atlas Cloud uses in-flight compression that doesn't compress anything that is
 * bigger than 10MB, we want to make sure that compass-web assets stay under the
 * limit so that they are compressed when served
 */
const MAX_COMPRESSION_FILE_SIZE = 10_000_000;

module.exports = (env, args) => {
  let config = createWebConfig({
    ...args,
    hot: false,
    entry: path.resolve(__dirname, 'src', 'index.tsx'),
  });

  delete config.externals;

  return merge(config, {
    context: __dirname,
    resolve: {
      alias: {
        '@mongodb-js/compass-components': require.resolve(
          '@mongodb-js/compass-components',
        ),
        '@haohanyang/compass-web': require.resolve('@haohanyang/compass-web'),
        '@emotion/server/create-instance': localPolyfill(
          '@emotion/server/create-instance',
        ),
        'hadron-document': require.resolve('hadron-document'),
        path: require.resolve('path-browserify'),
        crypto: require.resolve("crypto-browserify"),
        url: require.resolve('whatwg-url'),
        tls: localPolyfill('tls'),
        net: localPolyfill('net'),
        stream: require.resolve('readable-stream'),
        vm: require.resolve('vm-browserify')
      },
    },
    plugins: [
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
        process: [localPolyfill('process'), 'process'],
      }),

      new CopyPlugin({
        patterns: ['src/favicon.svg', 'src/index.html'],
      }),
    ],
    performance: {
      hints: 'warning',
      maxEntrypointSize: MAX_COMPRESSION_FILE_SIZE,
      maxAssetSize: MAX_COMPRESSION_FILE_SIZE,
    },
  });
};
