const fs = require('fs');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const _ = require('lodash');
const DataService = require('../lib/data_service');

const {
  exportCSVFromQuery,
} = require('../dist/compass-import-export/export/export-csv');

dotenv.config();

const mongo = new MongoClient(process.env.MONGO_TEST_URI);
const dataService = new DataService(mongo);

exportCSVFromQuery({
  ns: 'sample_airbnb.listingsAndReviews',
  query: {
    filter: {
      property_type: 'Apartment',
    },
    projection: {
      _id: 0,
      name: 1,
      description: 1,
    },
  },
  dataService,
  output: fs.createWriteStream('listingsAndReviews.csv'),
  delimiter: ',',
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
