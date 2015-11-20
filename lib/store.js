var sjcl = require('sjcl');
var ENCPARAMS = {
  cipher: 'aes',
  mode: 'gcm',
  ks: 128,
  ts: 128
};


/**
 * Encrypt plaintext using AES-GCM-128.
 *
 * @param {bitArray} encKey - encryption key returned from keys.deriveKeys
 * @param {string} plaintext
 * @returns {object}
 */
function encrypt(encKey, plaintext) {
  return sjcl.encrypt(encKey, plaintext, ENCPARAMS);
}


/**
 * Decrypt something that was encrypted using AES-GCM-128 and the
 * specified key.
 *
 * @param {bitArray} encKey - encryption key returned from keys.deriveKeys
 * @param {object} cipherobj
 * @returns {string}
 */
function decrypt(encKey, cipherobj) {
  return sjcl.decrypt(encKey, cipherobj, ENCPARAMS);
}


module.exports = {
  encrypt: encrypt,
  decrypt: decrypt
};
