const path = require('path');
const esbuild = require('esbuild');

function localPolyfill(name) {
    return path.resolve(__dirname, 'polyfills', ...name.split('/'), 'index.ts');
}

esbuild.build({
    entryPoints: ['src/index.tsx'], // Your entry file
    bundle: true,
    outfile: 'dist/bundle.js', // Output file
    //loader: { '.tsx': 'tsx' }, // For loading TypeScript and JSX
    inject: ['./esbuild.inject.js'],
    define: {
        'process.env.NODE_ENV': '"development"',
        'process.env.APP_ENV': 'web'
    },
    sourcemap: true,
    alias: {
        path: 'path-browserify',
        stream: 'readable-stream',
        url: 'whatwg-url',
        tls: localPolyfill("tls"),
        fs: localPolyfill('fs'),
        'fs/promises': localPolyfill('fs/promises'),
        util: require.resolve('util/'),
        // Buffer: require.resolve('buffer/'),
        // buffer: require.resolve('buffer/'),
        events: require.resolve('events/'),
        vm: 'vm-browserify',
        tr46: localPolyfill('tr46'),
        net: localPolyfill('net'),
        'timers/promises': 'timers-browserify',
        timers: 'timers-browserify',
        os: 'os-browserify/browser',
        crypto: 'crypto-browserify',
        dns: localPolyfill('dns'),
        // Built-in Node.js modules imported by the driver directly and used in
        // ways that requires us to provide a no-op polyfill
        zlib: localPolyfill('zlib'),
        kerberos: localPolyfill('throwError'),
        '@mongodb-js/zstd': localPolyfill('throwError'),
        '@aws-sdk/credential-providers': localPolyfill('throwError'),
        'gcp-metadata': localPolyfill('throwError'),
        snappy: localPolyfill('throwError'),
        socks: localPolyfill('throwError'),
        aws4: localPolyfill('throwError'),
        'mongodb-client-encryption': localPolyfill('throwError'),

    },
    // plugins: [
    //     {
    //         name: 'polyfill',
    //         setup(build) {

    //             build.onResolve({ filter: /^buffer$/ }, args => ({
    //                 path: require.resolve('buffer/'),
    //                 namespace: 'file',
    //             }))

    //             build.onResolve({ filter: /^process$/ }, args => ({
    //                 path: localPolyfill("process"),
    //                 namespace: 'file',
    //             }))
    //         },
    //     },
    // ],
}).catch(() => process.exit(1));