const { MongoClient } = require('mongodb');
const { Transform } = require('stream');
const { EJSON } = require('bson');
const { getDBandCollectionFromNs, objectToIdiomaticEJSON } = require('./utils');

/**
 *
 * @param {MongoClient} client
 * @param {string} ns
 * @param {{filter: object, project: object?, collation: object?, limit: number, skip: number, sort: object?, projection: object?}} query
 * @param {{defaultSortOrder: string?, maxTimeMS: number?}} preferences
 * @param {'default' | 'relaxed' | 'canonical'} jsonFormatVariant
 */
function exportJSONFromQuery(
  client,
  ns,
  query,
  preferences,
  jsonFormatVariant
) {
  const [db_name, coll_name] = getDBandCollectionFromNs(ns);

  const collection = client.db(db_name).collection(coll_name);

  const findCursor = collection.find(query.filter, {
    projection: query.projection ?? undefined,
    limit: query.limit ?? undefined,
    sort:
      query.sort ??
      (preferences.defaultSortOrder
        ? JSON.parse(preferences.defaultSortOrder)
        : undefined),
    skip: query.skip ?? undefined,
    collation: query.collation ?? undefined,
    promoteValues: false,
    bsonRegExp: true,
  });

  /** @type {import('bson').EJSONOptions} */
  let ejsonOptions = undefined;

  if (jsonFormatVariant === 'relaxed') {
    ejsonOptions = {
      relaxed: true,
    };
  } else if (jsonFormatVariant === 'canonical') {
    ejsonOptions = {
      relaxed: false,
    };
  }
  let docsWritten = 0;

  const docStream = new Transform({
    objectMode: true,
    transform: function (chunk, encoding, callback) {
      if (docsWritten === 0) {
        this.push('[');
      }

      ++docsWritten;

      try {
        const doc =
          jsonFormatVariant === 'default'
            ? objectToIdiomaticEJSON(chunk, { indent: 2 })
            : EJSON.stringify(chunk, undefined, 2, ejsonOptions);
        const line = `${docsWritten > 1 ? ',\n' : ''}${doc}`;

        callback(null, line);
      } catch (err) {
        callback(err);
      }
    },
    final: function (callback) {
      this.push(']');
      callback(null);
    },
  });

  const inputStream = findCursor.stream();
  return inputStream.pipe(docStream);
}

module.exports = {
  exportJSONFromQuery,
};
