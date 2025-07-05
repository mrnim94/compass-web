const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const _ = require('lodash');
const DataService = require('../lib/data_service');
const {
  importJSON,
} = require('../dist/compass-import-export/import/import-json');

dotenv.config();

const mongo = new MongoClient(process.env.MONGO_TEST_URI);
const dataService = new DataService(mongo);

const filePath = path.resolve(
  __dirname,
  '..',
  ...'compass/packages/compass-import-export/test/jsonl/good.jsonl'.split('/')
);
const ns = 'test.importJSONTest';

importJSON({
  dataService: dataService,
  ns: ns,
  input: fs.createReadStream(filePath),
  output: process.stdout,
  jsonVariant: 'jsonl',
})
  .then((res) => {
    console.log(res);
  })
  .catch((err) => {
    console.error(err);
  })
  .finally(() => {
    mongo.close();
  });
