module.exports = {
  presets: [
    [
      './compass/node_modules/@babel/preset-env',
      { targets: { node: 'current' } },
    ],
    './compass/node_modules/@babel/preset-typescript',
  ],
};
