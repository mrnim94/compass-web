const path = require('path');
const { Eta } = require('eta');
const { readCliArgs } = require('./cli');
const { registerWs } = require('./ws');
const { registerAuth } = require('./auth');
const { registerRoutes } = require('./routes');

const args = readCliArgs();

const fastify = require('fastify')({
  logger: true,
});

fastify.decorate('args', args);

fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, '..', 'dist'),
});

fastify.register(require('@fastify/view'), {
  engine: {
    eta: new Eta(),
  },
  root: path.join(__dirname, '..', 'dist'),
});

fastify.register(require('@fastify/websocket'));

fastify.register(require('@fastify/cookie'));

// CSRF protection
fastify.register(require('@fastify/csrf-protection'), {
  getToken: (req) => {
    return req.headers['csrf-token'];
  },
  sessionPlugin: '@fastify/cookie',
});

// File upload
fastify.register(require('@fastify/multipart'));

registerWs(fastify);

registerAuth(fastify);

fastify.after(() => {
  registerRoutes(fastify);
});

module.exports = fastify;
