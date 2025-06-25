const fs = require('fs');
const path = require('path');
const { buffer, text } = require('stream/consumers');
const {
  describe,
  expect,
  test,
  beforeEach,
  beforeAll,
  afterAll,
} = require('@jest/globals');
const { EJSON } = require('bson');
const { MongoClient } = require('mongodb');
const { exportJSONFromQuery } = require('./export');
const allTypesDocs =
  require('../compass/packages/compass-import-export/test/docs/all-bson-types').default;
const testDB = 'export-json-test';
const testColl = 'test-col';
const testNS = `${testDB}.${testColl}`;
const {
  fixtures,
} = require('../compass/packages/compass-import-export/test/fixtures');

function replaceIds(text) {
  return text.replace(
    /"\$oid": "\w{24}"/g,
    '"$oid": "123456789012345678901234"'
  );
}

describe('exportJSON', function () {
  /** @type {MongoClient} */
  let mongoClient;

  /** @type {import('mongodb').Collection} */
  let coll;

  beforeAll(() => {
    mongoClient = new MongoClient('mongodb://localhost:27017');
    coll = mongoClient.db(testDB).collection(testColl);
  });

  afterAll(async () => await mongoClient.close());

  beforeEach(async function () {
    try {
      await coll.drop();
    } catch (err) {}
  });

  test('exports to the output stream', async () => {
    await mongoClient
      .db(testDB)
      .collection(testColl)
      .insertOne({ testDoc: true });

    const output = await buffer(
      exportJSONFromQuery(
        testNS,
        { filter: {} },
        {},
        null,
        'default',
        mongoClient
      )
    );

    expect(output.byteLength).toBe(78);
  });

  for (const variant of ['default', 'relaxed', 'canonical']) {
    test(`exports all types for variant=${variant}`, async () => {
      await coll.insertMany(allTypesDocs);

      const result = await text(
        exportJSONFromQuery(
          testNS,
          { filter: {} },
          {},
          null,
          variant,
          mongoClient
        )
      );

      const resultText = replaceIds(result);
      const docs = EJSON.parse(resultText);

      const expectedPath = fixtures.allTypes.replace(
        /\.js$/,
        `.exported.${variant}.ejson`
      );
      let expectedText;
      let expectedDocs;
      try {
        expectedText = replaceIds(
          await fs.promises.readFile(expectedPath, 'utf8')
        );
        expectedDocs = EJSON.parse(expectedText);
      } catch (err) {
        console.log(expectedPath);
        console.log(resultText);
        throw err;
      }

      try {
        expect(resultText).toEqual(expectedText);
      } catch (err) {
        console.log(resultText);
        throw err;
      }
      expect(docs).toEqual(expectedDocs);
    });
  }

  for (const fixtureType of ['json', 'jsonl']) {
    for (const filepath of Object.values(fixtures[fixtureType])) {
      const basename = path.basename(filepath);

      test(`exports ${basename}`, async function () {
        const docsPath = filepath.replace(
          /\.((jsonl?)|(csv))$/,
          '.imported.ejson'
        );

        let importedText;
        let ejsonToInsert;
        let ejsonToInsertWithout_id; // insertMany mutates and adds _id to added docs when missing.
        let callbackCount = 0;
        try {
          importedText = await fs.promises.readFile(docsPath, 'utf8');
          ejsonToInsert = EJSON.parse(importedText);
          ejsonToInsertWithout_id = EJSON.parse(importedText);
          expect(ejsonToInsert.length).toBeGreaterThan(0);
        } catch (err) {
          // This helps to tell you which file is missing and what the expected
          // content is which helps when adding a new fixture.
          console.log(docsPath);
          console.log(importedText);
          throw err;
        }
        await coll.insertMany(ejsonToInsert);

        let resultText = await text(
          exportJSONFromQuery(
            testNS,
            { filter: {} },
            {},
            (v) => {
              callbackCount = v;
            },
            'default',
            mongoClient
          )
        );

        const docs = await coll.find({}).toArray();
        expect(docs.length).toBeGreaterThan(0);
        expect(docs.length).toBe(callbackCount);

        let writtenResultDocs;

        writtenResultDocs = EJSON.parse(resultText);

        const expectedResultsPath = filepath.replace(
          /\.((jsonl?)|(csv))$/,
          '.exported.ejson'
        );

        let expectedText;
        try {
          expectedText = await fs.promises.readFile(
            expectedResultsPath,
            'utf8'
          );
        } catch (err) {
          console.log(expectedResultsPath);
          console.log(resultText);
          throw err;
        }

        // Remove newly created _id's as they won't match when we compare below.
        if (!ejsonToInsertWithout_id[0]._id) {
          for (const doc of writtenResultDocs) {
            if (doc._id && doc._id._bsontype === 'ObjectId') {
              delete doc._id;
            }
          }
          for (const doc of ejsonToInsertWithout_id) {
            if (doc._id && doc._id._bsontype === 'ObjectId') {
              delete doc._id;
            }
          }

          expectedText = expectedText.replace(/^ +"\$oid": ".*$/gm, 'ObjectId');
          resultText = resultText.replace(/^ +"\$oid": ".*$/gm, 'ObjectId');
        }

        expect(writtenResultDocs).toEqual(ejsonToInsertWithout_id);
        expect(resultText).toEqual(expectedText);
      });
    }
  }

  test('handles an empty collection', async () => {
    const resultText = await text(
      exportJSONFromQuery(
        `${testDB}.test-empty`,
        { filter: {} },
        {},
        null,
        'default',
        mongoClient
      )
    );
    console.log(resultText);
    const writtenResultDocs = EJSON.parse(resultText);
    const expectedText = '[]';

    expect(writtenResultDocs).toEqual([]);
    expect(resultText).toEqual(expectedText);
  });
});
