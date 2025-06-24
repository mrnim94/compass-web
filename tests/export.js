const { MongoClient } = require('mongodb');
const { exportJSONFromQuery } = require('../lib/export');
const { pipeline } = require('stream/promises');
const fs = require('fs');

require('dotenv').config();

const client = new MongoClient(process.env.MONGO_ATLAS_URI);

pipeline([
  exportJSONFromQuery(
    client,
    'sample_airbnb.listingsAndReviews',
    {
      filter: {},
      limit: 10,
      sort: { _id: 1 },
      projection: { _id: 1 },
    },
    {},
    'default'
  ),
  fs.createWriteStream('listingsAndReviews.json', {}),
])
  .then(() => {
    console.log('Export completed successfully.');
  })
  .catch((err) => {
    console.error('Export failed:', err);
  })
  .finally(() => {
    client.close();
  });
