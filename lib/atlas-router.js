/**
 * Dummy Atlas services
 */

const express = require('express');
const router = express.Router();

router.get('/nds/clusters/:projectId', (req, res) => {
  res.json([]);
});

// Atlas GenAI services
router.get('/ai/v1/hello/:userId', (req, res) => {
  res.json({
    features: {},
  });
});

module.exports = router;
