/**
 * Manage connections stored in sessions
 */
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  if (!req.session.connections) {
    req.session.connections = [];
  }

  res.json(req.session.connections);
});

router.post('/', (req, res) => {
  const newConnection = req.body;

  if (!req.session.connections) {
    req.session.connections = [newConnection];
  } else {
    req.session.connections.push(newConnection);
  }

  res.json({
    message: 'Connection saved',
  });
});

router.delete('/:connectionId', (req, res) => {
  const connectionId = req.params.connectionId;

  if (!req.session.connections) {
    req.session.connections = [];
    res.status(400).json({
      message: `Connection ${connectionId} not found`,
    });
  } else {
    const totalConnections = req.session.connections.length;
    req.session.connections = req.session.connections.filter(
      (conn) => conn.id !== connectionId
    );

    if (totalConnections > req.session.connections.length) {
      res.status(400).json({
        message: `Connection ${connectionId} not found`,
      });
    } else {
      res.json({
        message: `Connection ${connectionId} was deleted`,
      });
    }
  }
});

module.exports = router;
