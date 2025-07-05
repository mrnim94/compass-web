const { MongoDBCollectionNamespace } = require('mongodb/lib/utils');

class DataService {
  mongoClient;

  /**
   *
   * @param {import('mongodb').MongoClient} mongoClient
   */
  constructor(mongoClient) {
    this.mongoClient = mongoClient;
  }
  /**
   * Performs multiple write operations with controls for order of execution.
   * @param {string} ns Namespace
   * @param {import('mongodb').AnyBulkWriteOperation} operations An array of `bulkWrite()` write operations.
   * @param {import('mongodb').BulkWriteOptions} options `bulkWrite()` options
   */
  bulkWrite(ns, operations, options) {
    const namespace = MongoDBCollectionNamespace.fromString(ns);

    return this.mongoClient
      .db(namespace.db)
      .collection(namespace.collection)
      .bulkWrite(operations, options);
  }

  /**
   * Insert a single document into the database.
   *
   * @param {string} ns - The namespace.
   * @param {import('mongodb').Document} doc - The document to insert.
   * @param {import('mongodb').InsertOneOptions} options - The options.
   */
  insertOne(ns, doc, options) {
    const namespace = MongoDBCollectionNamespace.fromString(ns);
    return this.mongoClient
      .db(namespace.db)
      .collection(namespace.collection)
      .insertOne(doc, options);
  }

  /**
   * Returns a find cursor on the collection.
   *
   * @param {string} ns - The namespace to search on.
   * @param {import('mongodb').Filter} filter - The query filter.
   * @param {import('mongodb').FindOptions} options - The query options.
   */
  findCursor(ns, filter, options) {
    const namespace = MongoDBCollectionNamespace.fromString(ns);
    return this.mongoClient
      .db(namespace.db)
      .collection(namespace.collection)
      .find(filter, options);
  }
}

module.exports = DataService;
