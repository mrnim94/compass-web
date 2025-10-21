import { BSON } from 'mongodb';

export const {
  EJSON,
  Double,
  Int32,
  Long,
  Binary,
  BSONRegExp,
  ObjectId,
  Timestamp,
  Decimal128,
  UUID,
  MinKey,
  MaxKey,
  serialize,
  deserialize,
} = BSON;

export default BSON;
