const fs = require('fs');
const { Writable } = require('stream');
const { randomBytes } = require('crypto');
const fastify = require('fastify')({ logger: false });
const dotenv = require('dotenv');
const _ = require('lodash');
const {
  exportJSONFromQuery,
} = require('../dist/compass-import-export/export/export-json');
const {
  exportCSVFromQuery,
} = require('../dist/compass-import-export/export/export-csv');
const {
  importJSON,
} = require('../dist/compass-import-export/import/import-json');
const {
  importCSV,
} = require('../dist/compass-import-export/import/import-csv');
const {
  analyzeCSVFields,
} = require('../dist/compass-import-export/import/analyze-csv-fields');
const {
  gatherFieldsFromQuery,
} = require('../dist/compass-import-export/export/gather-fields');
const DataService = require('../lib/data_service');

dotenv.config();

const dataService = new DataService(
  process.env.MONGO_TEST_URI ?? 'mongodb://localhost:27017'
);

fastify.register(require('@fastify/multipart'));

fastify.get('/download-json', async (request, reply) => {
  // reply.raw.setHeader('Content-Type', 'application/octet-stream');
  try {
    const result = await exportJSONFromQuery({
      ns: 'sample_airbnb.listingsAndReviews',
      query: {
        filter: {},
        limit: 10,
        projection: {
          name: 1,
          property_type: 1,
        },
      },
      dataService,
      output: new Writable({
        objectMode: true,
        write: (chunk, encoding, callback) => {
          reply.raw.write(chunk);
          callback();
        },
      }),
      variant: 'jsonl',
    });

    console.log('Export result', result);
  } catch (err) {
    console.error(err);
  } finally {
    reply.raw.end();
  }
});

fastify.get('/download-csv', async (request, reply) => {
  // reply.raw.setHeader('Content-Type', 'application/octet-stream');
  try {
    const result = await exportCSVFromQuery({
      ns: 'sample_airbnb.listingsAndReviews',
      query: {
        filter: {},
        limit: 10,
        projection: {
          name: 1,
          property_type: 1,
        },
      },
      dataService,
      delimiter: ',',
      output: new Writable({
        objectMode: true,
        write: (chunk, encoding, callback) => {
          reply.raw.write(chunk);
          callback();
        },
      }),
      variant: 'jsonl',
    });

    console.log('Export result', result);
  } catch (err) {
    console.error(err);
  } finally {
    reply.raw.end();
  }
});

fastify.post('/upload-json', async (request, reply) => {
  const file = await request.file();

  if (!file) {
    reply.status(400).send({ error: 'No file' });
  }

  const ns = request.params['ns'] ?? `test.${randomBytes(4).toString('hex')}`;

  try {
    const res = await importJSON({
      dataService,
      ns,
      jsonVariant: 'jsonl',
      input: fs.createReadStream(file.filename),
    });

    reply.send({
      message: 'ok',
      errors: res.docsErrored,
      processed: res.docsProcessed,
      written: res.docsWritten,
    });
  } catch (err) {
    console.error(err);
    reply.status(502).send({ error: err.message ?? 'Unknown error' });
  }
});

fastify.post('/upload-csv', async (request, reply) => {
  const file = await request.file();

  if (!file) {
    reply.status(400).send({ error: 'No file' });
  }

  const ns = request.params['ns'] ?? `test.${randomBytes(4).toString('hex')}`;

  try {
    const analyzeResult = await analyzeCSVFields({
      input: fs.createReadStream(file.filename),
      delimiter: ',',
    });

    const fields = _.mapValues(analyzeResult.fields, (field) => field.detected);

    const importResult = await importCSV({
      dataService,
      ns,
      delimiter: ',',
      fields,
      output: process.stdout,
      input: fs.createReadStream(file.filename),
    });

    reply.send({
      message: 'ok',
      errors: importResult.docsErrored,
      processed: importResult.docsProcessed,
      written: importResult.docsWritten,
    });
  } catch (err) {
    console.error(err);
    reply.status(502).send({ error: err.message ?? 'Unknown error' });
  }
});

fastify.get('/gather-fields', async (request, reply) => {
  const res = await gatherFieldsFromQuery({
    ns: 'sample_airbnb.listingsAndReviews',
    dataService,
    query: {
      filter: {},
      limit: 100,
    },
  });

  reply.send({
    docsProcessed: res.docsProcessed,
    paths: res.paths,
  });
});

fastify.listen({ port: 3000 }, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      Promise.allSettled([fastify.close(), dataService.disconnect()]);
    });
  }
});
