function debug(prefix) {
  return (...args) => {
    console.log(prefix, args);
  };
}

module.exports = debug;
