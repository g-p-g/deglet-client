var sjcl = require('sjcl');


/**
 * Generate 32 bits * numWords using SJCL's PRNG and encode
 * the result as a hexadecimal string.
 * numWords must be at least 1 (which produces a string of length 8)
 *
 * @param {number} [numWords]
 * @returns {string}
 */
function randomHex(numWords) {
  var nw = parseInt(numWords);
  if (nw < 1) {
    throw new Error("numWords < 1");
  }

  var paranoia = 6;
  var ran = sjcl.random.randomWords(nw, paranoia);
  var hex = sjcl.codec.hex.fromBits(ran);
  return hex;
}


module.exports = {
	randomHex: randomHex
}
