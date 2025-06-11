const path = require('path');
const fastify = require('fastify')({ logger: true });
const net = require('net');
const tls = require('tls');

const SOCKET_ERROR_EVENT_LIST = ['error', 'close', 'timeout', 'parseError'];

function encodeStringMessageWithTypeByte(message) {
  const utf8Encoder = new TextEncoder();
  const utf8Array = utf8Encoder.encode(message);
  return encodeMessageWithTypeByte(utf8Array, 0x01);
}

function encodeBinaryMessageWithTypeByte(message) {
  return encodeMessageWithTypeByte(message, 0x02);
}

function encodeMessageWithTypeByte(message, type) {
  const encoded = new Uint8Array(message.length + 1);
  encoded[0] = type;
  encoded.set(message, 1);
  return encoded;
}

function decodeMessageWithTypeByte(message) {
  const typeByte = message[0];
  if (typeByte === 0x01) {
    const jsonBytes = message.subarray(1);
    const textDecoder = new TextDecoder('utf-8');
    const jsonStr = textDecoder.decode(jsonBytes);
    return JSON.parse(jsonStr);
  } else if (typeByte === 0x02) {
    return message.subarray(1);
  }
}

let cleaningUp = false;

fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'dist'),
});

fastify.register(require('@fastify/websocket'));

fastify.get('/nds/clusters/:projectId', function handler(request, reply) {
  reply.send([]);
});

fastify.get(
  '/explorer/v1/groups/:projectId/clusters/connectionInfo',
  function handler(request, reply) {
    reply.send([
      {
        id: 'unique-id',
        connectionOptions: {
          connectionString: 'mongodb://localhost:27017',
        },
        atlasMetadata: {
          orgId: 'orgid',
          projectId: 'projectid',
          clusterUniqueId: 'uniqueid',
          clusterName: 'mycluster',
          clusterType: 'SHARDED',
          clusterState: 'IDLE',
          metricsId: 'metricsid',
          metricsType: 'cluster',
          supports: {
            globalWrites: false,
            rollingIndexes: false,
          },
        },
      },
    ]);
  }
);

fastify.register(async function (fastify) {
  fastify.get(
    '/clusterConnection/:projectId',
    { websocket: true },
    (socket, req) => {
      let mongoSocket;

      console.log(
        'new ws connection (total %s)',
        fastify.websocketServer.clients.size
      );

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
        logger.log('ws closed');
        mongoSocket?.removeAllListeners();
        mongoSocket?.end();
      });
    }
  );
});

fastify.setNotFoundHandler(function (request, reply) {
  reply.sendFile('index.html');
});

fastify.listen({ port: 3000 }, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      if (cleaningUp) {
        return false;
      }

      cleaningUp = true;

      fastify.close(() => {
        process.exit();
      });
    });
  }
});
