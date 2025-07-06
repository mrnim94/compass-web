const path = require('path');

// WebSocket message utilities
const SOCKET_ERROR_EVENT_LIST = ['error', 'close', 'timeout', 'parseError'];

/**
 *
 * @param {string} message
 * @returns
 */
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

/**
 *
 * @param {import('ws').RawData} message
 * @returns
 */
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

module.exports = {
  SOCKET_ERROR_EVENT_LIST,
  decodeMessageWithTypeByte,
  encodeStringMessageWithTypeByte,
  encodeBinaryMessageWithTypeByte,
};
