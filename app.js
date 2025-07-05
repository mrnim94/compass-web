#!/usr/bin/env node
'use strict';

const path = require('path');
const net = require('net');
const tls = require('tls');
const crypto = require('crypto');
const fastify = require('fastify')({
  logger: true,
});
const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const { ConnectionString } = require('mongodb-connection-string-url');
const { MongoClient } = require('mongodb');
const {
  decodeMessageWithTypeByte,
  encodeStringMessageWithTypeByte,
  encodeBinaryMessageWithTypeByte,
  SOCKET_ERROR_EVENT_LIST,
} = require('./lib/utils');
// const {
//   exportJSONFromAggregation,
//   exportJSONFromQuery,
//   exportCSVFromAggregation,
//   exportCSVFromQuery,
// } = require('./lib/export');
const NodeCache = require('node-cache');

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
 * @type {Object.<string, MongoClient>}
 */
const mongoClients = {};

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
  mongoClients[id] = new MongoClient(uri.href);
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

  fastify.get('/export/:exportId', (request, reply) => {
    const exportId = request.params.exportId;
    const exportOptions = exportIds.get(exportId);

    if (exportOptions) {
      const mongoClient = mongoClients[exportOptions.connectionId];

      if (!mongoClient) {
        reply.status(400).send({
          error: "Connection doesn't exist",
        });
        return;
      }

      reply.header('Content-Type', 'application/octet-stream');

      if (exportOptions.type == 'json') {
        reply.header(
          'Content-Disposition',
          `attachment; filename="${exportOptions.ns}.json"`
        );
        if (exportOptions.query) {
          reply.send(
            exportJSONFromQuery(
              exportOptions.ns,
              exportOptions.query,
              {},
              exportOptions.jsonFormatVariant,
              mongoClient
            )
          );
        } else {
          reply.send(
            exportJSONFromAggregation(
              exportOptions.ns,
              exportOptions.aggregation,
              exportOptions.preferences,
              {},
              exportOptions.jsonFormatVariant,
              mongoClient
            )
          );
        }
      } else {
        reply.header(
          'Content-Disposition',
          `attachment; filename="${exportOptions.ns}.csv"`
        );
        if (exportOptions.query) {
          exportCSVFromQuery(
            exportOptions.ns,
            exportOptions.query,
            ',',
            null,
            mongoClient
          ).then((stream) => reply.send(stream));
        } else {
          exportCSVFromAggregation(
            exportOptions.ns,
            exportOptions.aggregation,
            exportOptions.preferences,
            ',',
            null,
            mongoClient
          ).then((stream) => reply.send(stream));
        }
      }
    } else {
      reply.status(404).send({
        error: 'Export not found',
      });
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
        Object.entries(mongoClients).map(([_, client]) => client.close()),
      ]).finally(() => {
        clearTimeout(timeout);
        process.exit();
      });
    });
  }
});
