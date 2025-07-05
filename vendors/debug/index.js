function debug(prefix) {
  return (...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(prefix, args);
    }
  };
}

module.exports = debug;
