const fs = require('fs');
const path = require('path');
const {
  describe,
  expect,
  test,
  beforeEach,
  beforeAll,
  afterAll,
} = require('@jest/globals');
const { MongoClient } = require('mongodb');
const { Readable } = require('stream');
const { EJSON } = require('bson');
const { MongoDBCollectionNamespace } = require('mongodb/lib/utils');
const dotenv = require('dotenv');
const { importJSON } = require('./import');
const {
  fixtures,
} = require('../compass/packages/compass-import-export/test/fixtures');
const {
  guessFileType,
} = require('../compass/packages/compass-import-export/src/import/guess-filetype');

dotenv.config();

describe('importJSON', () => {
  /** @type {MongoClient} */
  let mongoClient;

  /** @type {import('mongodb').Collection} */
  let coll;

  beforeAll(async () => {
    mongoClient = new MongoClient(
      process.env.MONGO_TEST_URI ?? 'mongodb://localhost:27017'
    );

    await mongoClient.connect();

    coll = mongoClient.db('db').collection('col');
  });

  beforeEach(async () => {
    try {
      await coll.drop();
    } catch (err) {
      // ignore
    }
  });

  afterAll(() => mongoClient.close());

  for (const fixtureType of ['json', 'jsonl']) {
    for (const filepath of Object.values(fixtures[fixtureType])) {
      const basename = path.basename(filepath);

      test(`imports ${basename}`, async () => {
        const typeResult = await guessFileType({
          input: fs.createReadStream(filepath),
        });
        expect(typeResult.type).toBe(fixtureType);

        const ns = 'db.col';

        const progressCallback = jest.fn();
        const result = await importJSON({
          mongoClient,
          ns,
          input: fs.createReadStream(filepath),
          callbacks: {
            progressCallback: progressCallback,
          },
          jsonVariant: fixtureType,
        });

        const callCount = progressCallback.mock.calls.length;
        expect(callCount).toBeGreaterThan(0);

        const totalRows = callCount;

        const firstCallArg = progressCallback.mock.calls[0];
        expect(firstCallArg[0]).toBeGreaterThan(0); // bytesProcessed
        expect(firstCallArg[1]).toBe(1); // docsProcessed
        expect(firstCallArg[2]).toBe(0); // docsWritten

        delete result.biggestDocSize;
        expect(result).toEqual({
          docsErrored: 0,
          docsWritten: totalRows,
          docsProcessed: totalRows,
          hasUnboundArray: false,
        });

        const docs = await coll.find({}, { promoteValues: false }).toArray();

        expect(docs.length).toBe(totalRows);

        // these won't match when we compare below
        for (const doc of docs) {
          if (doc._id && doc._id._bsontype === 'ObjectId') {
            delete doc._id;
          }
        }

        const resultPath = filepath.replace(
          /\.((jsonl?)|(csv))$/,
          '.imported.ejson'
        );
        let text;
        try {
          text = await fs.promises.readFile(resultPath, 'utf8');
        } catch (err) {
          // This helps to tell you which file is missing and what the expected
          // content is which helps when adding a new .csv fixture
          console.log(resultPath);
          console.log(EJSON.stringify(docs, undefined, 2, { relaxed: false }));
          throw err;
        }

        const expectedResult = EJSON.parse(text, { relaxed: false });
        expect(docs).toEqual(expectedResult);
      });
    }
  }

  test('imports a file with a document field', async () => {
    const lines = [JSON.stringify({ document: 1 })];

    const ns = 'db.col';
    const progressCallback = jest.fn();
    const result = await importJSON({
      mongoClient,
      ns,
      input: Readable.from(lines.join('\n')),
      callbacks: {
        progressCallback: progressCallback,
      },
      jsonVariant: 'jsonl',
    });

    delete result.biggestDocSize;
    expect(result).toEqual({
      docsErrored: 0,
      docsProcessed: 1,
      docsWritten: 1,
      hasUnboundArray: false,
    });
    // expect(result.docsErrored).toBe(0);
    // expect(result.docsProcessed).toBe(1);
    // expect(result.docsWritten).toBe(1);
    // expect(result.hasUnboundArray).toBeFalsy();

    const docs = await coll.find({}).toArray();

    expect(docs.length).toBe(1);

    for (const doc of docs) {
      delete doc._id;
      expect(doc).toEqual({ document: 1 });
    }

    expect(progressCallback).toHaveBeenCalledTimes(1);
  });

  test('imports a file containing multiple batches', async () => {
    const lines = [];
    for (let i = 0; i < 2000; i++) {
      lines.push(JSON.stringify({ i }));
    }

    const ns = 'db.col';
    const progressCallback = jest.fn();
    const result = await importJSON({
      mongoClient,
      ns,
      input: Readable.from(lines.join('\n')),
      callbacks: {
        progressCallback: progressCallback,
      },
      jsonVariant: 'jsonl',
    });

    delete result.biggestDocSize;
    expect(result).toEqual({
      docsErrored: 0,
      docsProcessed: 2000,
      docsWritten: 2000,
      hasUnboundArray: false,
    });

    const docs = await coll.find({}).toArray();

    expect(docs.length).toBe(2000);

    for (const [i, doc] of docs.entries()) {
      delete doc._id;
      expect(doc).toEqual({ i });
    }

    expect(progressCallback).toHaveBeenCalledTimes(2000);
  });

  test('errors if a json file does not parse', async () => {
    const ns = 'db.col';

    const promise = importJSON({
      mongoClient,
      ns,
      input: Readable.from('x'),
      // should fail regardless of stopOnErrors because the whole file doesn't parse
      stopOnErrors: false,
      jsonVariant: 'json',
    });

    await expect(promise).rejects.toThrow(
      'Parser cannot parse input: expected a value'
    );
  });

  test('errors if a jsonl file does not parse', async () => {
    const ns = 'db.col';
    importJSON({
      mongoClient,
      ns,
      input: Readable.from('x'),
      // should fail regardless of stopOnErrors because the whole file doesn't parse
      stopOnErrors: false,
      jsonVariant: 'jsonl',
    }).catch((err) => {
      console.log(err);
    });
    await expect(
      importJSON({
        mongoClient,
        ns,
        input: Readable.from('x'),
        // should fail regardless of stopOnErrors because the whole file doesn't parse
        stopOnErrors: false,
        jsonVariant: 'jsonl',
      })
    ).rejects.toThrow('Parser cannot parse input: expected a value');
  });

  test('errors if a json file is passed as jsonl', async () => {
    const ns = 'db.col';

    const promise = importJSON({
      mongoClient,
      ns,
      input: Readable.from('[{"a": 1}]'),
      stopOnErrors: true,
      jsonVariant: 'jsonl',
    });

    await expect(promise).rejects.toThrow('Value is not an object [Index 0]');
  });

  test('errors if a jsonl file is passed as json', async () => {
    const ns = 'db.col';

    const promise = importJSON({
      mongoClient,
      ns,
      input: Readable.from('{"a": 1}'),
      // should fail regardless of stopOnErrors because the whole file doesn't parse
      stopOnErrors: false,
      jsonVariant: 'json',
    });

    await expect(promise).rejects.toThrow(
      'Top-level object should be an array.'
    );
  });

  test('errors if a json file contains things that are not arrays', async () => {
    const ns = 'db.col';

    const promise = importJSON({
      mongoClient,
      ns,
      input: Readable.from('5'),
      // should fail regardless of stopOnErrors because the whole file doesn't parse
      stopOnErrors: false,
      jsonVariant: 'json',
    });

    await expect(promise).rejects.toThrow(
      'Top-level object should be an array.'
    );
  });

  test('errors if a jsonl file contains things that are not objects', async () => {
    const ns = 'db.col';

    const promise = importJSON({
      mongoClient,
      ns,
      input: Readable.from('{ "a": 1}\n5'),
      stopOnErrors: true,
      jsonVariant: 'jsonl',
    });

    await expect(promise).rejects.toThrow('Value is not an object [Index 1]');
  });

  test('errors if there are parse errors (stopOnErrors=true)', async () => {
    const lines = [];

    lines.push(
      JSON.stringify({
        date: {
          $date: {
            $numberLong: '', // broken extended json
          },
        },
      })
    );

    lines.push(
      JSON.stringify({
        date: {
          $date: {
            $numberLong: '974395800000',
          },
        },
      })
    );

    const ns = 'db.col';

    const promise = importJSON({
      mongoClient,
      ns,
      input: Readable.from(lines.join('\n')),
      stopOnErrors: true,
      jsonVariant: 'jsonl',
    });

    await expect(promise).rejects.toThrow(
      '$numberLong string "" is in an invalid format [Index 0]'
    );
  });

  test('reports and writes parse errors (stopOnErrors=false)', async () => {
    const lines = [];

    lines.push(
      JSON.stringify({
        date: {
          $date: {
            $numberLong: '', // broken extended json
          },
        },
      })
    );

    lines.push(
      JSON.stringify({
        date: {
          $date: {
            $numberLong: '974395800000',
          },
        },
      })
    );

    const ns = 'db.col';
    const progressCallback = jest.fn();
    const errorCallback = jest.fn();

    const result = await importJSON({
      mongoClient,
      ns,
      input: Readable.from(lines.join('\n')),
      stopOnErrors: false,
      jsonVariant: 'jsonl',
      callbacks: {
        progressCallback: progressCallback,
        errorCallback: errorCallback,
      },
    });

    delete result.biggestDocSize;
    expect(result).toEqual({
      docsErrored: 1,
      docsProcessed: 2,
      docsWritten: 1,
      hasUnboundArray: false,
    });

    expect(progressCallback).toHaveBeenCalledTimes(2);
    expect(errorCallback).toHaveBeenCalledTimes(1);

    const expectedErrors = [
      {
        name: 'BSONError',
        message: '$numberLong string "" is in an invalid format [Index 0]',
      },
    ];

    const errorsArgs = errorCallback.mock.calls.map((args) => args[0]);
    expect(errorsArgs).toEqual(expectedErrors);
  });

  test('errors if there are database errors (stopOnErrors=true)', async () => {
    const lines = [{ i: 0 }, { i: 1 }].map((doc) => JSON.stringify(doc));

    const ns = 'db.col';
    const nsObj = MongoDBCollectionNamespace.fromString(ns);

    await mongoClient.db(nsObj.db).createCollection(nsObj.collection, {
      validator: {
        $jsonSchema: {
          required: ['xxx'],
        },
      },
    });

    const promise = importJSON({
      mongoClient,
      ns,
      input: Readable.from(lines.join('\n')),
      stopOnErrors: true,
      jsonVariant: 'jsonl',
      callbacks: {},
    });

    await expect(promise).rejects.toThrow('Document failed validation');
  });

  test('reports and writes database errors (stopOnErrors=false)', async () => {
    const lines = [{ i: 0 }, { i: 1 }].map((doc) => JSON.stringify(doc));

    const ns = 'db.col';
    const nsObj = MongoDBCollectionNamespace.fromString(ns);

    await mongoClient.db(nsObj.db).createCollection(nsObj.collection, {
      validator: {
        $jsonSchema: {
          required: ['xxx'],
        },
      },
    });

    const progressCallback = jest.fn();
    const errorCallback = jest.fn();

    const result = await importJSON({
      mongoClient,
      ns,
      input: Readable.from(lines.join('\n')),
      stopOnErrors: false,
      jsonVariant: 'jsonl',
      callbacks: {
        progressCallback: progressCallback,
        errorCallback: errorCallback,
      },
    });

    delete result.biggestDocSize;
    expect(result).toEqual({
      docsErrored: 2,
      docsProcessed: 2,
      docsWritten: 0,
      hasUnboundArray: false,
    });

    expect(progressCallback).toHaveBeenCalledTimes(2);
    expect(errorCallback).toHaveBeenCalledTimes(2);

    const expectedErrors = [
      {
        name: 'WriteError',
        message: 'Document failed validation',
        index: 0,
        code: 121,
      },
      {
        name: 'WriteError',
        message: 'Document failed validation',
        index: 1,
        code: 121,
      },
    ];

    const errors = errorCallback.mock.calls.map((args) => args[0]);
    for (const [index, error] of errors.entries()) {
      expect(error).toHaveProperty(['errInfo', 'details']);
      expect(error).toHaveProperty('op');
      delete error.op;
      delete error.errInfo;
      expect(error).toEqual(expectedErrors[index]);
    }
  });

  test('errors if a file is not valid utf8', async () => {
    const testDocs = [
      {
        ê: 1,
        foo: 2,
      },
    ];
    const latin1Buffer = Buffer.from(JSON.stringify(testDocs), 'latin1');
    const input = Readable.from(latin1Buffer);

    const ns = 'db.col';

    await expect(
      importJSON({
        mongoClient,
        ns,
        input,
        jsonVariant: 'json',
      })
    ).rejects.toThrow('The encoded data was not valid for encoding utf-8');
  });

  test('strips the BOM character', async () => {
    const text = await fs.promises.readFile(fixtures.json.good, 'utf8');
    const input = Readable.from('\uFEFF' + text);

    const ns = 'db.col';

    await importJSON({
      mongoClient,
      ns,
      input,
      jsonVariant: 'json',
    });

    const docs = await coll
      .find({}, { promoteValues: false, bsonRegExp: true })
      .toArray();

    expect(docs.length).toBe(3);

    for (const doc of docs) {
      expect(Object.keys(doc)).toEqual(['_id', 'uuid', 'name']);
    }
  });
});
