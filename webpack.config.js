const path = require('path');
const {
  webpack,
  createWebConfig,
  merge,
} = require('@mongodb-js/webpack-config-compass');
const CopyPlugin = require('copy-webpack-plugin');
const nodeExternals = require('webpack-node-externals');

function localPolyfill(name) {
  return path.resolve(__dirname, 'polyfills', ...name.split('/'), 'index.ts');
}

/**
 * Atlas Cloud uses in-flight compression that doesn't compress anything that is
 * bigger than 10MB, we want to make sure that compass-web assets stay under the
 * limit so that they are compressed when served
 */
const MAX_COMPRESSION_FILE_SIZE = 10_000_000;

module.exports = (env) => {
  if (env.target === 'node') {
    // Build server
    return {
      target: 'node',
      entry: './app.js',
      mode: process.env.NODE_ENV || 'development',
      output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'app.js',
      },
      externals: [nodeExternals()],
      plugins: [
        new webpack.BannerPlugin({ banner: "#!/usr/bin/env node\n", raw: true }),
      ],
      module: {
        rules: [
          {
            test: /\.js$/,
            exclude: /node_modules/,
            use: {
              loader: 'babel-loader',
              options: {
                presets: ['@babel/preset-env'],
              },
            },
          },
        ],
      },
    };
  }

  // Build client
  let clientConfig = createWebConfig({
    hot: false,
    mode: env.production ? 'production' : 'development',
    entry: path.resolve(__dirname, 'src', 'index.tsx'),
  });

  delete clientConfig.externals;

  return merge(clientConfig, {
    context: __dirname,
    output: {
      filename: "compass.js"
    },
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
