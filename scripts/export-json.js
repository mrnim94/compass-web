const fs = require('fs');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const _ = require('lodash');
const DataService = require('../lib/data_service');

const {
  exportJSONFromQuery,
} = require('../dist/compass-import-export/export/export-json');

dotenv.config();

const mongo = new MongoClient(process.env.MONGO_TEST_URI);
const dataService = new DataService(mongo);

exportJSONFromQuery({
  ns: 'sample_airbnb.listingsAndReviews',
  query: {
    filter: {
      property_type: 'Apartment',
    },
    limit: 30,
  },
  dataService,
  output: fs.createWriteStream('listingsAndReviews.jsonl'),
  variant: 'jsonl',
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
