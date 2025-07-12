#!/usr/bin/env node
'use strict';

const path = require('path');
const net = require('net');
const tls = require('tls');
const crypto = require('crypto');
const fs = require('fs');
const { Writable } = require('stream');
const fastify = require('fastify')({
  logger: true,
});
const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const { ConnectionString } = require('mongodb-connection-string-url');
const {
  decodeMessageWithTypeByte,
  encodeStringMessageWithTypeByte,
  encodeBinaryMessageWithTypeByte,
  SOCKET_ERROR_EVENT_LIST,
} = require('./lib/utils');
const NodeCache = require('node-cache');
const {
  exportJSONFromQuery,
  exportJSONFromAggregation,
} = require('./dist/compass-import-export/export/export-json');
const {
  exportCSVFromQuery,
  exportCSVFromAggregation,
} = require('./dist/compass-import-export/export/export-csv');
const {
  gatherFieldsFromQuery,
} = require('./dist/compass-import-export/export/gather-fields');
const {
  importJSON,
} = require('./dist/compass-import-export/import/import-json');
const {
  guessFileType,
} = require('./dist/compass-import-export/import/guess-filetype');
const { importCSV } = require('./dist/compass-import-export/import/import-csv');
const {
  listCSVFields,
} = require('./dist/compass-import-export/import/list-csv-fields');

const {
  analyzeCSVFields,
} = require('./dist/compass-import-export/import/analyze-csv-fields');

const DataService = require('./lib/data_service');

const args = yargs(hideBin(process.argv))
  .env('CW')
  .options('mongo-uri', {
    type: 'string',
    description:
      'MongoDB connection string, e.g. mongodb://localhost:27017. Multiple connections can be specified by separating them with whitespaces.',
    demandOption: true,
  })
  .version(require('./package.json').version)
  .options('port', {
    type: 'number',
    description: 'Port to run the server on',
    default: 8080,
  })
  .options('host', {
    type: 'string',
    description: 'Host to run the server on',
    default: 'localhost',
  })
  .options('org-id', {
    type: 'string',
    description: 'Organization ID for the connection',
    default: 'default-org-id',
  })
  .options('project-id', {
    type: 'string',
    description: 'Project ID for the connection',
    default: 'default-project-id',
  })
  .options('cluster-id', {
    type: 'string',
    description: 'Cluster ID for the connection',
    default: 'default-cluster-id',
  })
  .option('basic-auth-username', {
    type: 'string',
    description: 'Username for Basic HTTP authentication scheme',
  })
  .option('basic-auth-password', {
    type: 'string',
    description: 'Password for Basic HTTP authentication scheme',
  })
  .option('app-name', {
    type: 'string',
    description: 'Name of the application',
    default: 'Compass Web',
  })
  .parse();

let mongoURIStrings = args.mongoUri.trim().split(/\s+/);
const mongoURIs = [];

/**
 * @type {Object.<string, DataService>}
 */
const mongoServices = {};

// Validate MongoDB connection strings
let urlParsingError = '';
mongoURIStrings.forEach((uri, index) => {
  try {
    const mongoUri = new ConnectionString(uri);

    mongoURIs.push({
      uri: mongoUri,
      id: crypto.randomBytes(8).toString('hex'),
    });
  } catch (err) {
    urlParsingError += `Connection string no.${index + 1} is invalid: ${
      err.message
    }\n`;
  }
});

if (urlParsingError) {
  console.error(urlParsingError);
  process.exit(1);
}

// Validate basic auth settings
let basicAuth = null;

if (args.basicAuthUsername || args.basicAuthPassword) {
  if (!args.basicAuthPassword) {
    console.error('Basic auth password is not set');
    process.exit(1);
  } else if (!args.basicAuthUsername) {
    console.error('Basic auth username is not set');
    process.exit(1);
  }

  basicAuth = {
    username: args.basicAuthUsername,
    password: args.basicAuthPassword,
  };
}

for (const { uri, id } of mongoURIs) {
  mongoServices[id] = new DataService(uri.href);
}

let shuttingDown = false;

const exportIds = new NodeCache({ stdTTL: 3600 });

fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'dist'),
});

fastify.register(require('@fastify/websocket'));

// Websocket proxy for MongoDB connections
fastify.register(async (fastify) => {
  fastify.get(
    '/clusterConnection/:projectId',
    { websocket: true },
    (socket, req) => {
      if (req.params.projectId !== args.projectId) {
        return;
      }

      console.log(
        'new ws connection (total %s)',
        fastify.websocketServer.clients.size
      );
      let mongoSocket;

      socket.on('message', async (message) => {
        if (mongoSocket) {
          mongoSocket.write(decodeMessageWithTypeByte(message), 'binary');
        } else {
          // First message before socket is created is with connection info
          const { tls: useSecureConnection, ...connectOptions } =
            decodeMessageWithTypeByte(message);

          console.log(
            'setting up new%s connection to %s:%s',
            useSecureConnection ? ' secure' : '',
            connectOptions.host,
            connectOptions.port
          );
          mongoSocket = useSecureConnection
            ? tls.connect({
                servername: connectOptions.host,
                ...connectOptions,
              })
            : net.createConnection(connectOptions);
          mongoSocket.setKeepAlive(true, 300000);
          mongoSocket.setTimeout(30000);
          mongoSocket.setNoDelay(true);
          const connectEvent = useSecureConnection
            ? 'secureConnect'
            : 'connect';
          SOCKET_ERROR_EVENT_LIST.forEach((evt) => {
            mongoSocket.on(evt, (err) => {
              console.log('server socket error event (%s)', evt, err);
              socket.close(evt === 'close' ? 1001 : 1011);
            });
          });
          mongoSocket.on(connectEvent, () => {
            console.log(
              'server socket connected at %s:%s',
              connectOptions.host,
              connectOptions.port
            );
            mongoSocket.setTimeout(0);
            const encoded = encodeStringMessageWithTypeByte(
              JSON.stringify({ preMessageOk: 1 })
            );
            socket.send(encoded);
          });
          mongoSocket.on('data', async (data) => {
            socket.send(encodeBinaryMessageWithTypeByte(data));
          });
        }
      });

      socket.on('close', () => {
        mongoSocket?.removeAllListeners();
        mongoSocket?.end();
      });
    }
  );
});

fastify.register(require('@fastify/multipart'));

if (basicAuth) {
  fastify.register(require('@fastify/basic-auth'), {
    validate: (username, password, _req, _reply, done) => {
      if (username === basicAuth.username && password === basicAuth.password) {
        done();
      } else {
        done(new Error('Authentication error'));
      }
    },
    authenticate: true,
  });
}

fastify.after(() => {
  if (basicAuth) {
    fastify.addHook('onRequest', fastify.basicAuth);
  }

  fastify.get('/projectId', (request, reply) => {
    reply.type('text/plain').send(args.projectId);
  });

  fastify.get('/cloud-mongodb-com/v2/:projectId/params', (request, reply) => {
    if (request.params.projectId == args.projectId) {
      reply.send({
        orgId: args.orgId,
        projectId: args.projectId,
        appName: args.appName,
      });
    } else {
      reply.status(404).send({
        message: 'Project not found',
      });
    }
  });

  fastify.get(
    '/explorer/v1/groups/:projectId/clusters/connectionInfo',
    (request, reply) => {
      reply.send(
        mongoURIs.map(({ uri, id }) => ({
          id: id,
          connectionOptions: {
            connectionString: uri.href,
          },
          atlasMetadata: {
            orgId: args.orgId,
            projectId: args.projectId,
            clusterUniqueId: args.clusterId,
            clusterName: uri.hosts[0],
            clusterType: 'REPLICASET',
            clusterState: 'IDLE',
            metricsId: 'metricsid',
            metricsType: 'replicaSet',
            supports: {
              globalWrites: false,
              rollingIndexes: false,
            },
          },
        }))
      );
    }
  );

  fastify.post('/export-csv', (request, reply) => {
    // TODO: validate
    const exportId = crypto.randomBytes(8).toString('hex');
    exportIds.set(exportId, {
      ...request.body,
      type: 'csv',
    });

    reply.send(exportId);
  });

  fastify.post('/export-json', (request, reply) => {
    // TODO: validate
    const exportId = crypto.randomBytes(8).toString('hex');
    exportIds.set(exportId, {
      ...request.body,
      type: 'json',
    });

    reply.send(exportId);
  });

  // TODO: internal
  fastify.get('/exports', (request, reply) => {
    const data = {};
    exportIds.keys().forEach((key) => {
      data[key] = exportIds.get(key);
    });

    reply.send(data);
  });

  fastify.get('/export/:exportId', async (request, reply) => {
    const exportId = request.params.exportId;
    const exportOptions = exportIds.get(exportId);

    if (exportOptions) {
      const mongoService = mongoServices[exportOptions.connectionId];

      if (!mongoService) {
        reply.status(400).send({
          error: "Connection doesn't exist",
        });
      }

      reply.raw.setHeader('Content-Type', 'application/octet-stream');

      let res;
      const outputStream = new Writable({
        objectMode: true,
        write: (chunk, encoding, callback) => {
          reply.raw.write(chunk);
          callback();
        },
      });

      try {
        if (exportOptions.type == 'json') {
          reply.raw.setHeader(
            'Content-Disposition',
            `attachment; filename="${exportOptions.ns}.json"`
          );

          if (exportOptions.query) {
            res = await exportJSONFromQuery({
              ns: exportOptions.ns,
              query: exportOptions.query,
              dataService: mongoService,
              output: outputStream,
            });
          } else {
            res = await exportJSONFromAggregation({
              ns: exportOptions.ns,
              aggregation: exportOptions.aggregation,
              preferences: exportOptions.preferences,
              dataService: mongoService,
              output: outputStream,
            });
          }
        } else {
          reply.raw.setHeader(
            'Content-Disposition',
            `attachment; filename="${exportOptions.ns}.csv"`
          );

          if (exportOptions.query) {
            res = await exportCSVFromQuery({
              ns: exportOptions.ns,
              query: exportOptions.query,
              dataService: mongoService,
              output: outputStream,
            });
          } else {
            res = await exportCSVFromAggregation({
              ns: exportOptions.ns,
              aggregation: exportOptions.aggregation,
              preferences: exportOptions.preferences,
              dataService: mongoService,
              output: outputStream,
            });
          }
        }

        console.log(`Export ${exportId} result`, res);
      } catch (err) {
        console.error(`Export ${exportId} failed`, err);
      } finally {
        reply.raw.end();
      }
    } else {
      reply.status(404).send({
        error: 'Export not found',
      });
    }
  });

  fastify.post('/gather-fields', async (request, reply) => {
    const connectionId = request.body.connectionId;

    const mongoService = connectionId ? mongoServices[connectionId] : null;

    if (!mongoService) {
      reply.status(400).reply({ error: 'connection id not found' });
    }

    const res = await gatherFieldsFromQuery({
      ns: request.body.ns,
      dataService: mongoService,
      query: request.body.query,
      sampleSize: request.body.sampleSize,
    });

    reply.send({
      docsProcessed: res.docsProcessed,
      paths: res.paths,
    });
  });

  fastify.post('/guess-filetype', async (request, reply) => {
    const file = await request.file();

    if (!file) {
      reply.status(400).send({ error: 'No file' });
    }

    const guessFileTypeRes = await guessFileType({
      input: file.file,
    });

    let listCSVFieldsRes = null;
    if (guessFileTypeRes.type === 'csv') {
      listCSVFieldsRes = await listCSVFields({
        input: fs.createReadStream(file.filename),
        delimiter: res.csvDelimiter,
        newline: res.newline,
      });
    }

    reply.send({
      ...guessFileTypeRes,
      csvFields: listCSVFieldsRes,
    });
  });

  fastify.post('/upload-json', async (request, reply) => {
    const file = await request.file();

    if (!file) {
      reply.status(400).send({ error: 'No file' });
    }

    const rawJson = file.fields.json?.value;
    if (!rawJson) {
      reply.status(400).send({ error: 'No json body' });
    }

    const body = JSON.parse(rawJson);

    const mongoService = body.connectionId
      ? mongoServices[body.connectionId]
      : null;
    if (!mongoService) {
      reply.status(400).send({ error: 'connection id not found' });
    }

    try {
      const res = await importJSON({
        dataService: mongoService,
        ns: body.ns,
        jsonVariant: body.jsonVariant,
        input: file.file,
        stopOnErrors: body.stopOnErrors,
      });

      reply.send(res);
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

    const rawJson = file.fields.json?.value;
    if (!rawJson) {
      reply.status(400).send({ error: 'No json body' });
    }

    const body = JSON.parse(rawJson);

    const mongoService = body.connectionId
      ? mongoServices[body.connectionId]
      : null;
    if (!mongoService) {
      reply.status(400).send({ error: 'connection id not found' });
    }

    try {
      const importResult = await importCSV({
        dataService: mongoService,
        ns: body.ns,
        delimiter: body.delimiter,
        fields: body.delimiter,
        input: file.file,
      });

      reply.send(res);
    } catch (err) {
      console.error(err);
      reply.status(502).send({ error: err.message ?? 'Unknown error' });
    }
  });

  fastify.setNotFoundHandler((request, reply) => {
    reply.sendFile('index.html');
  });
});

fastify.listen({ port: args.port, host: args.host }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }

  // Clean up connections on shutdown
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      if (shuttingDown) {
        return;
      }

      shuttingDown = true;
      console.log('Shutting down the server...');

      // 20 seconds timeout to shutdown
      const timeout = setTimeout(() => {
        console.warn('Forcefully shutting down after 20 seconds.');
        process.exit(1);
      }, 20 * 1000);

      exportIds.close();

      Promise.allSettled([
        fastify.close(),
        // Close all MongoDB clients
        Object.entries(mongoServices).map(([_, service]) =>
          service.disconnect()
        ),
      ]).finally(() => {
        clearTimeout(timeout);
        process.exit();
      });
    });
  }
});
