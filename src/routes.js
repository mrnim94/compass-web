const { resolveSRVRecord } = require('mongodb/lib/connection_string');
const {
  ConnectionString,
  parseOptions,
} = require('mongodb-connection-string-url');
const pkgJson = require('../package.json');

/**
 *
 * @param {import('fastify').FastifyInstance} instance
 */
function registerRoutes(instance) {
  const args = instance.args;

  if (args.basicAuth) {
    instance.addHook('onRequest', instance.basicAuth);
  }

  instance.get('/version', (request, reply) => {
    reply.send({
      version: pkgJson.version,
      source: `https://github.com/haohanyang/compass-web/tree/v${pkgJson.version}`,
    });
  });

  instance.get('/projectId', (request, reply) => {
    reply.type('text/plain').send(args.projectId);
  });

  instance.get('/cloud-mongodb-com/v2/:projectId/params', (request, reply) => {
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

  instance.get(
    '/explorer/v1/groups/:projectId/clusters/connectionInfo',
    async (request, reply) => {
      const connectionInfos = await Promise.all(
        args.mongoURIs.map(async ({ uri, id }) => {
          const clientConnectionString = await createClientSafeConnectionString(
            uri
          );
          return {
            id: id,
            connectionOptions: {
              connectionString: clientConnectionString,
            },
            atlasMetadata: {
              orgId: args.orgId,
              projectId: args.projectId,
              clusterUniqueId: args.clusterId,
              clusterName:
                (uri.hosts && uri.hosts[0]) ||
                uri.hostname ||
                'unknown-cluster',
              clusterType: 'REPLICASET',
              clusterState: 'IDLE',
              metricsId: 'metricsid',
              metricsType: 'replicaSet',
              supports: {
                globalWrites: false,
                rollingIndexes: false,
              },
            },
          };
        })
      );
      reply.send(connectionInfos);
    }
  );

  instance.setNotFoundHandler((request, reply) => {
    const csrfToken = reply.generateCsrf();
    reply.view('index.eta', { csrfToken, appName: args.appName });
  });
}

/**
 * Create a client-safe connection string that avoids problematic SRV parsing in the frontend.
 * The compass frontend has code paths that assume hosts array exists when parsing connection strings.
 * For SRV URIs, we'll resolve the actual hosts and ports using the MongoDB driver utilities.
 * @param {import('mongodb-connection-string-url').ConnectionString} cs
 */
async function createClientSafeConnectionString(cs) {
  try {
    const isSrv = cs.protocol && cs.protocol.includes('srv');

    if (!isSrv) {
      return cs.href; // Non-SRV URIs are fine as-is
    }

    const res = await resolveSRVRecord(parseOptions(cs.toString()));
    cs.protocol = 'mongodb';
    cs.isSRV = false;
    cs.hosts = res.map((address) => address.toString());

    return cs.toString();
  } catch (_e) {
    return cs.href; // Fallback to original if SRV resolution fails
  }
}

module.exports = { registerRoutes };
