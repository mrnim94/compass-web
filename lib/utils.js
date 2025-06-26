const { EJSON } = require('bson');
const maxFourYearDate = new Date('9999-12-31T23:59:59.999Z').valueOf();

/**
 * Turn a BSON value into what we consider idiomatic extended JSON.
 * From `compass/packages/hadron-document/src/utils.ts`
 * @param {*} value
 * @param {{ indent: (number | string)?}} options
 * @returns
 */
function objectToIdiomaticEJSON(value, options) {
  const serialized = EJSON.serialize(value, {
    relaxed: false,
  });

  makeEJSONIdiomatic(serialized);

  return JSON.stringify(
    serialized,
    null,
    'indent' in options ? options.indent : 2
  );
}

function makeEJSONIdiomatic(value) {
  if (!value || typeof value !== 'object') return;

  for (const key of Object.keys(value)) {
    const entry = value[key];
    // We are only interested in object-like values, skip everything else
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    if (entry.$numberInt) {
      value[key] = +entry.$numberInt;
      continue;
    }
    if (entry.$numberDouble) {
      if (
        Number.isFinite(+entry.$numberDouble) &&
        !Object.is(+entry.$numberDouble, -0)
      ) {
        // EJSON can represent +/-Infinity or NaN values but JSON can't
        // (and -0 can be parsed from JSON but not serialized by JSON.stringify).
        value[key] = +entry.$numberDouble;
      }
      continue;
    }
    if (entry.$date && entry.$date.$numberLong) {
      const number = entry.$date.$numberLong;
      if (number >= 0 && number <= maxFourYearDate) {
        entry.$date = new Date(+number).toISOString();
      }
    }
    makeEJSONIdiomatic(entry);
  }
}

/**
 *
 * @param {import('../compass/packages/compass-preferences-model/src/preferences-schema').UserConfigurablePreferences} preferences
 * @param {number} value
 * @returns
 */
function capMaxTimeMSAtPreferenceLimit(preferences, value) {
  const preferenceMaxTimeMS = preferences.maxTimeMS;
  if (typeof value === 'number' && typeof preferenceMaxTimeMS === 'number') {
    return Math.min(value, preferenceMaxTimeMS);
  } else if (typeof preferenceMaxTimeMS === 'number') {
    return preferenceMaxTimeMS;
  }
  return value;
}

/**
 * Strinfy a BSON value to a readable string.
 * @param {import('bson').BSONValue} value
 */
function stringfyBsonValue(value) {
  const bsonType = value._bsontype;

  if (['Long', 'Int32', 'Double'].includes(bsonType)) {
    return value.toString();
  }

  if (value.toHexString) {
    // ObjectId and UUID both have toHexString() which does exactly what we want
    return value.toHexString();
  }

  if (bsonType === 'Binary') {
    // This should base64 encode the value which can't contain the delimiter,
    // line breaks or quotes
    return value.toJSON();
  }

  if (bsonType === 'BSONRegExp') {
    return `/${value.pattern}/${value.options}`;
  }

  if (bsonType === 'Decimal128') {
    // This should turn it into a number string with exponent
    return value.toString();
  }

  if (bsonType === 'Timestamp') {
    // This should turn it into a number string
    return value.toString();
  }

  if (bsonType === 'MinKey') {
    // Same as mongoexport
    return '$MinKey';
  }

  if (bsonType === 'MaxKey') {
    // Same as mongoexport
    return '$MaxKey';
  }

  // BSONSymbol, Code, DBRef and whatever new types get added
  return EJSON.stringify(value, { relaxed: false });
}

module.exports = {
  objectToIdiomaticEJSON,
  capMaxTimeMSAtPreferenceLimit,
  stringfyBsonValue,
};
