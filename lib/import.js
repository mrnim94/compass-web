const { Transform } = require('stream');
const { TextDecoder } = require('util');
const { parser } = require('stream-json');
const { streamValues } = require('stream-json/streamers/StreamValues');
const { streamArray } = require('stream-json/streamers/StreamArray');
const { isObject, MongoDBCollectionNamespace } = require('mongodb/lib/utils');
const { MongoClient } = require('mongodb');
const { EJSON } = require('bson');
const stripBomStream = require('strip-bom-stream');
const {
  errorToJSON,
  debug,
  hasArrayOfLength,
  writeErrorToJSError,
} = require('./utils');

class JSONTransformer {
  transform(chunk) {
    // make sure files parsed as jsonl only contain objects with no arrays and simple values
    // (this will either stop the entire import and throw or just skip this
    // one value depending on the value of stopOnErrors)
    if (!isObject(chunk.value)) {
      throw new Error('Value is not an object');
    }

    return EJSON.deserialize(chunk.value, {
      relaxed: false,
    });
  }

  lineAnnotation(numProcessed) {
    return ` [Index ${numProcessed - 1}]`;
  }
}

class Utf8Validator extends Transform {
  decoder = new TextDecoder('utf8', { fatal: true, ignoreBOM: true });

  _transform(chunk, enc, callback) {
    try {
      this.decoder.decode(chunk, { stream: true });
    } catch (err) {
      callback(err);
      return;
    }
    callback(null, chunk);
  }

  _flush(callback) {
    try {
      this.decoder.decode(new Uint8Array());
    } catch (err) {
      callback(err);
      return;
    }
    callback(null);
  }
}

class ByteCounter extends Transform {
  total = 0;

  _transform(chunk, enc, callback) {
    this.total += chunk.length;
    callback(null, chunk);
  }
}

class ImportWriterError extends Error {
  writeErrors;
  name = 'ImportWriterError';

  constructor(writeErrors) {
    super('Something went wrong while writing data to a collection');
    this.writeErrors = writeErrors;
  }
}

class ImportWriter {
  coll;
  ns;
  BATCH_SIZE;
  docsWritten;
  docsProcessed;
  docsErrored;
  stopOnErrors;
  /** @type {Array<import('mongodb').Document>} */
  batch;

  _batchCounter;

  errorCallback;

  /**
   * @param {import('mongodb').MongoClient} mongoClient
   * @param {string} ns
   * @param {boolean} stopOnErrors
   */
  constructor(mongoClient, ns, stopOnErrors) {
    this.ns = MongoDBCollectionNamespace.fromString(ns);
    this.coll = mongoClient.db(this.ns.db).collection(this.ns.collection);
    this.BATCH_SIZE = 1000;
    this.docsWritten = 0;
    this.docsProcessed = 0;
    this.docsErrored = 0;
    this.stopOnErrors = stopOnErrors;

    this.batch = [];
    this._batchCounter = 0;
  }

  /**
   *
   * @param {import('mongodb').Document} document
   */
  async write(document) {
    this.batch.push(document);

    if (this.batch.length >= this.BATCH_SIZE) {
      await this._executeBatch();
    }
  }

  async finish() {
    if (this.batch.length === 0) {
      debug('%d docs written', this.docsWritten);
      return;
    }

    debug('draining buffered docs', this.batch.length);

    await this._executeBatch();
  }

  async _executeBatch() {
    const documents = this.batch;

    this.docsProcessed += documents.length;

    this.batch = [];

    /** @type {import('mongodb').ClientBulkWriteResult} */
    let bulkWriteResult;

    try {
      bulkWriteResult = await this.coll.bulkWrite(
        documents.map((document) => ({
          insertOne: { document },
        })),
        {
          ordered: this.stopOnErrors,
          retryWrites: false,
          checkKeys: false,
        }
      );
    } catch (bulkWriteError) {
      // Currently, the server does not support batched inserts for FLE2:
      // https://jira.mongodb.org/browse/SERVER-66315
      // We check for this specific error and re-try inserting documents one by one.
      if (bulkWriteError.code === 6371202) {
        this.BATCH_SIZE = 1;

        bulkWriteResult = await this._insertOneByOne(documents);
      } else {
        // If we are writing with `ordered: false`, bulkWrite will throw and
        // will not return any result, but server might write some docs and bulk
        // result can still be accessed on the error instance

        // Driver seems to return null instead of undefined in some rare cases
        // when the operation ends in error, instead of relying on
        // `_mergeBulkOpResult` default argument substitution, we need to keep
        // this OR expression here
        bulkWriteResult = bulkWriteError.result || {};

        if (this.stopOnErrors) {
          this.docsWritten += bulkWriteResult.insertedCount || 0;
          this.docsErrored +=
            (bulkWriteResult.getWriteErrors?.() || []).length || 0;
          throw bulkWriteError;
        }
      }
    }

    const bulkOpResult = this._getBulkOpResult(bulkWriteResult);

    const writeErrors = (bulkWriteResult?.getWriteErrors?.() || []).map(
      writeErrorToJSError
    );

    this.docsWritten += bulkOpResult.insertedCount;
    this.docsErrored += bulkOpResult.numWriteErrors;
    this._batchCounter++;

    if (writeErrors.length) {
      throw new ImportWriterError(writeErrors);
    }
  }

  async _insertOneByOne(documents) {
    let insertedCount = 0;
    const errors = [];

    for (const doc of documents) {
      try {
        await this.coll.insertOne(doc);
        insertedCount += 1;
      } catch (insertOneByOneError) {
        if (this.stopOnErrors) {
          this.docsWritten += insertedCount;
          this.docsErrored += 1;
          throw insertOneByOneError;
        }

        errors.push(insertOneByOneError);
      }
    }

    return {
      insertedCount,
      getWriteErrors: () => {
        return errors;
      },
    };
  }

  _getBulkOpResult(result) {
    const writeErrors = result.getWriteErrors?.() || [];

    return {
      insertedCount: result.insertedCount || 0,
      numWriteErrors: writeErrors.length,
    };
  }
}

class DocStatsCollector {
  stats = { biggestDocSize: 0, hasUnboundArray: false };

  /**
   *
   * @param {import('mongodb').Document} doc
   */
  collect(doc) {
    this.stats.hasUnboundArray =
      this.stats.hasUnboundArray || hasArrayOfLength(doc, 250);
    try {
      const docString = JSON.stringify(doc);
      this.stats.biggestDocSize = Math.max(
        this.stats.biggestDocSize,
        docString.length
      );
    } catch (error) {
      // We ignore the JSON stringification error
    }
  }

  getStats() {
    return this.stats;
  }
}

/**
 * @typedef {{ns: string,
 * input: import('stream').Readable,
 * jsonVariant: 'jsonl' | 'json',
 * stopOnErrors: boolean,
 * mongoClient: import('mongodb').MongoClient,
 * callbacks: ImportCallbacks?}} ImportJSONOptions
 */

/**
 *
 * @param {ImportJSONOptions}
 * @returns
 */
function importJSON({
  ns,
  input,
  jsonVariant,
  stopOnErrors,
  mongoClient,
  callbacks,
}) {
  const transformer = new JSONTransformer();

  const streams = [];

  if (jsonVariant === 'jsonl') {
    streams.push(parser({ jsonStreaming: true }));
    streams.push(streamValues());
  } else {
    streams.push(parser());
    streams.push(streamArray());
  }

  return doImport(input, streams, transformer, {
    mongoClient,
    ns,
    stopOnErrors,
    callbacks,
    stopOnErrors,
  });
}

/**
 *
 * @param {ImportWriter} importWriter
 * @param {number} numProcessed
 * @param {number} numParseErrors
 * @param {DocStatsCollector} docStatsStream
 * @param {boolean} aborted
 */
function makeImportResult(
  importWriter,
  numProcessed,
  numParseErrors,
  docStatsStream,
  aborted
) {
  const result = {
    docsErrored: numParseErrors + importWriter.docsErrored,
    docsWritten: importWriter.docsWritten,
    ...docStatsStream.getStats(),
    // docsProcessed is not on importWriter so that it includes docs that
    // produced parse errors and therefore never made it that far
    docsProcessed: numProcessed,
  };

  if (aborted) {
    result.aborted = aborted;
  }

  return result;
}

/**
 * @typedef {{progressCallback: ProgressCallbackFunc?, errorCallback: ErrorCallbackFunc?}} ImportCallbacks
 */

/**
 * @callback ProgressCallbackFunc
 * @param {number} bytesProcessed
 * @param {number} docsProcessed
 * @param {number} docsWritten
 */

/**
 * @callback ErrorCallbackFunc
 * @param {object} error
 */

/**
 *
 * @param {import('stream').Readable} input
 * @param {Array<import('stream').Transform>} streams
 * @param {JSONTransformer} transformer
 * @param {{ns: string, mongoClient: MongoClient, callbacks: ImportCallbacks?, stopOnErrors: boolean}} options
 */
async function doImport(
  input,
  streams,
  transformer,
  { ns, mongoClient, callbacks, stopOnErrors }
) {
  const byteCounter = new ByteCounter();

  /** @type {import('stream').Readable | import('stream').Duplex} */
  let stream;

  const docStatsCollector = new DocStatsCollector();

  const importWriter = new ImportWriter(mongoClient, ns, stopOnErrors);

  let numProcessed = 0;
  let numParseErrors = 0;

  // Stream errors just get thrown synchronously unless we listen for the event
  // on each stream we use in the pipeline. By destroying the stream we're
  // iterating on and passing the error, the "for await line" will throw inside
  // the try/catch below. Relevant test: "errors if a file is truncated utf8"
  function streamErrorListener(error) {
    stream.destroy(error);
  }

  input.once('error', streamErrorListener);

  stream = input;

  const allStreams = [
    new Utf8Validator(),
    byteCounter,
    stripBomStream(),
    ...streams,
  ];

  for (const s of allStreams) {
    stream = stream.pipe(s);
    stream.once('error', streamErrorListener);
  }

  try {
    for await (const chunk of stream) {
      // Call progress and increase the number processed even if it errors
      // below. The import writer stats at the end stores how many got written.
      // This way progress updates continue even if every row fails to parse.
      ++numProcessed;

      callbacks?.progressCallback?.(
        byteCounter.total,
        numProcessed,
        importWriter.docsWritten
      );

      let doc;
      try {
        doc = transformer.transform(chunk);
      } catch (err) {
        ++numParseErrors;
        // deal with transform error

        // rethrow with the line number / array index appended to aid debugging
        err.message = `${err.message}${transformer.lineAnnotation(
          numProcessed
        )}`;

        if (stopOnErrors) {
          throw err;
        } else {
          const transformedError = errorToJSON(err);
          debug('transform error', transformedError);
          callbacks?.errorCallback?.(transformedError);
        }
        continue;
      }

      docStatsCollector.collect(doc);

      try {
        // write
        await importWriter.write(doc);
      } catch (err) {
        // if there is no writeErrors property, then it isn't an
        // ImportWriteError, so probably not recoverable
        if (!err.writeErrors) {
          throw err;
        }

        if (stopOnErrors) {
          throw err;
        }

        const errors = err.writeErrors;
        for (const error of errors) {
          const transformedError = errorToJSON(error);
          callbacks?.errorCallback?.(transformedError);
        }
      }
    }

    input.removeListener('error', streamErrorListener);
    for (const s of allStreams) {
      s.removeListener('error', streamErrorListener);
    }

    // also insert the remaining partial batch
    try {
      await importWriter.finish();
    } catch (err) {
      // if there is no writeErrors property, then it isn't an
      // ImportWriteError, so probably not recoverable
      if (!err.writeErrors) {
        throw err;
      }

      if (stopOnErrors) {
        throw err;
      }

      const errors = err.writeErrors;
      for (const error of errors) {
        const transformedError = errorToJSON(error);
        callbacks?.errorCallback?.(transformedError);
      }
    }
  } catch (err) {
    if (err.code === 'ABORT_ERR') {
      const result = makeImportResult(
        importWriter,
        numProcessed,
        numParseErrors,
        docStatsCollector,
        true
      );
      return result;
    }

    // stick the result onto the error so that we can tell how far it got
    err.result = makeImportResult(
      importWriter,
      numProcessed,
      numParseErrors,
      docStatsCollector
    );

    throw err;
  }

  const result = makeImportResult(
    importWriter,
    numProcessed,
    numParseErrors,
    docStatsCollector
  );

  return result;
}

module.exports = {
  importJSON,
};
