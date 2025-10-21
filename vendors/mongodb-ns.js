const { MongoDBCollectionNamespace } = require('mongodb/lib/utils');

module.exports = function (ns) {
  return MongoDBCollectionNamespace.fromString(ns);
};
