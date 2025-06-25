const { MongoClient } = require('mongodb');
const { Transform, Readable } = require('stream');
const { EJSON } = require('bson');
const { getDBandCollectionFromNs, objectToIdiomaticEJSON } = require('./utils');

/**
 *
 * @param {Readable} input
 * @param {function?} progressCallback
 * @param {import('../compass/packages/compass-import-export/src/export/export-json').ExportJSONFormat} variant
 */
function exportJSON(input, progressCallback, variant) {
  /** @type {import('bson').EJSONOptions} */
  let ejsonOptions = undefined;

  if (variant === 'relaxed') {
    ejsonOptions = {
      relaxed: true,
    };
  } else if (variant === 'canonical') {
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
      progressCallback?.(docsWritten);

      try {
        const doc =
          variant === 'default'
            ? objectToIdiomaticEJSON(chunk, { indent: 2 })
            : EJSON.stringify(chunk, undefined, 2, ejsonOptions);
        const line = `${docsWritten > 1 ? ',\n' : ''}${doc}`;

        callback(null, line);
      } catch (err) {
        callback(err);
      }
    },
    final: function (callback) {
      if (docsWritten === 0) {
        this.push('[');
      }

      this.push(']');
      callback(null);
    },
  });

  return input.pipe(docStream);
}

/**
 *
 * @param {string} ns
 * @param {import('../compass/packages/compass-import-export/src/export/export-types').ExportQuery} query
 * @param {import('../compass/packages/compass-preferences-model/src/preferences-schema').UserConfigurablePreferences} preferences
 * @param {function?} progressCallback
 * @param {import('../compass/packages/compass-import-export/src/export/export-json').ExportJSONFormat} variant
 * @param {MongoClient} client
 *
 */
function exportJSONFromQuery(
  ns,
  query,
  preferences,
  progressCallback,
  variant,
  client
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

  return exportJSON(findCursor.stream(), progressCallback, variant);
}

module.exports = {
  exportJSONFromQuery,
};
