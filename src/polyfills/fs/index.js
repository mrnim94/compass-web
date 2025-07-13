export function rmSync() {
  throw new Error('Not supported in browser: rmSync');
}

export function readFileSync() {
  throw new Error('Not supported in browser: readFileSync');
}

export function stat(path, cb) {
  setTimeout(() => {
    cb(null, {});
  }, 0);
}

export function exists(path, cb) {
  setTimeout(() => {
    cb(null, true);
  }, 0);
}

export const promises = {
  chmod() {
    return Promise.resolve();
  },

  access() {
    return Promise.resolve();
  },

  readFile() {
    return Promise.reject(
      new Error('Not supported in browser environment: readFile')
    );
  },
};

export default { promises, rmSync, readFileSync, stat, exists };
