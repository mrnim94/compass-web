const fs = require('fs');
const { pipeline } = require('stream/promises');
const { MongoClient } = require('mongodb');
const { Transform } = require('stream');
const { isObject, MongoDBCollectionNamespace } = require('mongodb/lib/utils');
const { stringify } = require('csv-stringify');
const { EJSON } = require('bson');
const { parser } = require('stream-json');
const { streamValues } = require('stream-json/streamers/StreamValues');
const {
  objectToIdiomaticEJSON,
  capMaxTimeMSAtPreferenceLimit,
  stringfyBsonValue,
  generateTempFilename,
} = require('./utils');
const { ReadStream } = require('fs');

/**
 *
 * @param {string} ns
 * @param {import('../compass/packages/compass-import-export/src/export/export-types').ExportAggregation} aggregation
 * @param {import('../compass/packages/compass-preferences-model/src/preferences-schema').UserConfigurablePreferences} preferences
 * @param {MongoClient} client
 * @returns
 */
function createAggregationCursor(ns, aggregation, preferences, client) {
  const namespace = MongoDBCollectionNamespace.fromString(ns);

  const collection = client.db(namespace.db).collection(namespace.collection);

  const { stages, options: aggregationOptions = {} } = aggregation;

  aggregationOptions.maxTimeMS = capMaxTimeMSAtPreferenceLimit(
    preferences,
    aggregationOptions.maxTimeMS
  );
  aggregationOptions.promoteValues = false;
  aggregationOptions.bsonRegExp = true;

  return collection.aggregate(stages, aggregationOptions);
}

/**
 *
 * @param {string} ns
 * @param {import('../compass/packages/compass-import-export/src/export/export-types').ExportQuery} query
 * @param {MongoClient} client
 */
function createFindCursor(ns, query, client) {
  const namespace = MongoDBCollectionNamespace.fromString(ns);

  const collection = client.db(namespace.db).collection(namespace.collection);

  return collection.find(query.filter ?? {}, {
    projection: query.projection,
    sort: query.sort,
    limit: query.limit,
    skip: query.skip,
    collation: query.collation,
    promoteValues: false,
    bsonRegExp: true,
  });
}

/**
 *
 * @param {import('mongodb').AggregationCursor |import('mongodb').FindCursor} cursor
 * @param {function?} progressCallback
 * @param {import('../compass/packages/compass-import-export/src/export/export-json').ExportJSONFormat} variant
 */
function exportJSON(cursor, progressCallback, variant) {
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

  return cursor.stream().pipe(docStream);
}

/**
 *
 * @param {import('mongodb').AggregationCursor |import('mongodb').FindCursor} cursor
 * @param {function?} progressCallback
 * @param {string} delimiter
 */
async function exportCSV(cursor, progressCallback, delimiter) {
  // Get column names
  let columnSet = new Set();

  // Save jsonl to a temporary file
  const tempFileNname = generateTempFilename('.jsonl');

  try {
    await pipeline([
      cursor.stream(),
      new Transform({
        objectMode: true,
        transform: (doc, encoding, callback) => {
          if (isObject(doc)) {
            Object.keys(doc).forEach((key) => {
              if (key) columnSet.add(key);
            });
          }
          callback(null, `${EJSON.stringify(doc, { relaxed: true })}\n`);
        },
      }),
      fs.createWriteStream(tempFileNname),
    ]);
  } finally {
    cursor.close();
  }

  if (columnSet.size === 0) {
    return ReadStream.from('\n'); // Return an empty CSV with just a newline
  }

  const columns = Array.from(columnSet).sort();

  const input = fs
    .createReadStream(tempFileNname)
    .pipe(parser({ jsonStreaming: true }))
    .pipe(streamValues())
    .pipe(
      new Transform({
        objectMode: true,
        transform: (data, encoding, callback) => {
          callback(null, EJSON.deserialize(data.value, { relaxed: false }));
        },
      })
    );

  let docsWritten = 0;
  return input
    .pipe(
      stringify({
        header: true,
        columns: columns,
        delimiter: delimiter,
        cast: {
          date: (value) => {
            return value.toISOString();
          },
          object: (value) => {
            return value._bsontype
              ? stringfyBsonValue(value)
              : EJSON.stringify(value, { relaxed: false });
          },
        },
      })
    )
    .pipe(
      new Transform({
        objectMode: true,
        transform: (chunk, encoding, callback) => {
          ++docsWritten;
          progressCallback?.(docsWritten);
          callback(null, chunk);
        },
      })
    );
}

/**
 *
 * @param {string} ns
 * @param {import('../compass/packages/compass-import-export/src/export/export-types').ExportAggregation} aggregation
 * @param {import('../compass/packages/compass-preferences-model/src/preferences-schema').UserConfigurablePreferences} preferences
 * @param {function?} progressCallback
 * @param {import('../compass/packages/compass-import-export/src/export/export-json').ExportJSONFormat} variant
 * @param {MongoClient} client
 *
 */
function exportJSONFromAggregation(
  ns,
  aggregation,
  preferences,
  progressCallback,
  variant,
  client
) {
  const cursor = createAggregationCursor(ns, aggregation, preferences, client);

  return exportJSON(cursor, progressCallback, variant);
}

/**
 *
 * @param {string} ns
 * @param {import('../compass/packages/compass-import-export/src/export/export-types').ExportQuery} query
 * @param {function?} progressCallback
 * @param {import('../compass/packages/compass-import-export/src/export/export-json').ExportJSONFormat} variant
 * @param {MongoClient} client
 *
 */
function exportJSONFromQuery(ns, query, progressCallback, variant, client) {
  const cursor = createFindCursor(ns, query, client);

  return exportJSON(cursor, progressCallback, variant);
}

/**
 *
 * @param {string} ns
 * @param {import('../compass/packages/compass-import-export/src/export/export-types').ExportQuery} query
 * @param {string} delimiter
 * @param {function?} progressCallback
 * @param {MongoClient} client
 *
 */
async function exportCSVFromQuery(
  ns,
  query,
  delimiter,
  progressCallback,
  client
) {
  const cursor = createFindCursor(ns, query, client);

  return exportCSV(cursor, progressCallback, delimiter);
}

/**
 *
 * @param {string} ns
 * @param {import('../compass/packages/compass-import-export/src/export/export-types').ExportAggregation} aggregation
 * @param {import('../compass/packages/compass-preferences-model/src/preferences-schema').UserConfigurablePreferences} preferences
 * @param {string} delimiter
 * @param {function?} progressCallback
 * @param {MongoClient} client
 *
 */
async function exportCSVFromAggregation(
  ns,
  aggregation,
  preferences,
  delimiter,
  progressCallback,
  client
) {
  const cursor = createAggregationCursor(ns, aggregation, preferences, client);

  return exportCSV(cursor, progressCallback, delimiter);
}

module.exports = {
  exportJSONFromQuery,
  exportJSONFromAggregation,
  exportCSVFromQuery,
  exportCSVFromAggregation,
};
