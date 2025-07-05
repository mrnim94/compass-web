const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const {
  importCSV,
} = require('../dist/compass-import-export/import/import-csv');
const {
  analyzeCSVFields,
} = require('../dist/compass-import-export/import/analyze-csv-fields');
const _ = require('lodash');
const DataService = require('../lib/data_service');

dotenv.config();

const mongo = new MongoClient(process.env.MONGO_TEST_URI);
const dataService = new DataService(mongo);

const filePath = path.resolve(
  __dirname,
  '..',
  ...'/compass/packages/compass-import-export/test/csv/types/double.csv'.split(
    '/'
  )
);
const ns = 'test.importCSVTest';

analyzeCSVFields({
  input: fs.createReadStream(filePath),
  delimiter: ',',
  newline: '\n',
})
  .then((res) => {
    console.log(res);
    const fields = _.mapValues(res.fields, (field) => field.detected);
    return importCSV({
      dataService: dataService,
      ns: ns,
      fields: fields,
      input: fs.createReadStream(filePath),
      output: process.stdout,
    });
  })
  .catch((err) => {
    console.error(err);
  })
  .finally(() => {
    mongo.close();
  });

// importCSV({
//   dataService: ds,
//   ns: 'test.mytest',
//   fields: [],
//   input: fs.createReadStream(
//     '/home/ubuntu/compass-web/compass/packages/compass-import-export/test/csv/types/double.csv'
//   ),
//   output: process.stdout,
// })
//   .then((res) => {
//     console.log(res);
//   })
//   .catch((err) => {
//     console.error(err);
//   })
//   .finally(() => {
//     mongo.close();
//   });

// importJSON({
//   dataService: ds,
//   ns: 'test.mytest',
//   input: fs.createReadStream('transactions.json'),
//   output: process.stdout,
//   jsonVariant: 'jsonl',
// })
//   .then((res) => {
//     console.log(res);
//   })
//   .catch((err) => {
//     console.error(err);
//   })
//   .finally(() => {
//     mongo.close();
//   });
