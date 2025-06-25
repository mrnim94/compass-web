const { describe, expect, test } = require('@jest/globals');
const { getDBandCollectionFromNs } = require('./utils');

describe('getDBandCollectionFromNs should return correct database and collection names', () => {
  test('normal namespace', () => {
    expect(getDBandCollectionFromNs('db.mycollection')).toEqual([
      'db',
      'mycollection',
    ]);
  });

  test('collection with dots', () => {
    expect(getDBandCollectionFromNs('db.my.first.collection')).toEqual([
      'db',
      'my.first.collection',
    ]);
  });

  test('invalid namespace', () => {
    expect(() => getDBandCollectionFromNs('dbcollection')).toThrow(
      'Invalid namespace format'
    );
  });
});
