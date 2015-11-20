"use strict";

var async = require('async');
var assign = require('object-assign');
var request = require('superagent');
var BWC = require('bitcore-wallet-client');
var auth = require('./auth');
var keys = require('./keys');
var util = require('./util');
var store = require('./store');

var API_URL = 'http://localhost:5000';

var DEFAULT_WALLETCLIENT_OPTS = {
  baseUrl: 'http://localhost:3232/bws/api',
  verbose: false
};

var DEFAULT_WALLET_OPTS = {
  network: 'livenet'  // Accepted: "livenet", "testnet"
};


function handleSignedResponse(err, res, url, cb) {
  var msg;

  if (res && res.text) {
    msg = auth.validateDeserialize(url, res.text);
  } else {
    msg = {payload: {data: {code: -1, error: err.toString()}}};
  }

  if (msg.payload.data && msg.payload.data.error) {
    cb(msg.payload.data, null);
  } else {
    cb(null, msg.payload.data);
  }
}


/**
 * Send a request signed by JWS to the API server.
 *
 * @param {string} method  - some method that supports a body (e.g. POST / PUT)
 * @param {string} url
 * @param {object} payload
 * @param {obect} key
 * @param {function} cb    - callback function
 */
function signedReq(method, url, payload, key, cb) {
  var message = auth.signSerialize(url, payload, key);
  request(method, url)
    .send(message)
    .set('Content-Type', 'application/jose')
    .end(function(err, res) {
      return handleSignedResponse(err, res, url, cb);
    });
}


/**
 * Send a GET request to the API server.
 *
 * @param {string} url
 * @param {object} payload - these are converted to query parameters
 * @param {function} cb    - callback function
 */
function simpleGet(url, payload, cb) {
  request
    .get(url)
    .query(payload)
    .end(function(err, res) {
      return handleSignedResponse(err, res, url, cb);
    });
}


/**
 * WalletClient constructor.
 *
 * @param {object} signKey - Object containing 'key' and 'address' for signing
 * @param {string} apiUrl
 * @param {object} opts    - Options to be passed to BWC
 * @constructor
 */
var WalletClient = function(signKey, apiUrl, opts) {
  var opts = assign({}, DEFAULT_WALLETCLIENT_OPTS, opts);
  this.bwc = new BWC(opts);
  this.sign = signKey;
  this.apiUrl = apiUrl || API_URL;
  return this;
};


/**
 * Retrieve salt and iteration count from remote server to derive the
 * local keys. The password does not leave this device but is used to
 * calculate check bytes used to retrieve the salt.
 *
 * The instance.sign is updated to use the just derivated signing key.
 *
 * @param {string} username
 * @param {string} password
 * @param {function} cb
 */
WalletClient.prototype.loadLocalData = function(username, password, cb) {
  var cbytes = keys.checkBytes(username + password);
  var opts = {username: username, check: cbytes};

  async.waterfall([

    async.apply(simpleGet, this.apiUrl + '/user/data', opts),

    function(res, callback) {
      var data = keys.deriveKeys(username, password, res.iterations, res.salt);
      this.sign = data.key.sign;
      callback(null, data);
    }.bind(this),

  ], function(err, results) {
    cb(err, results);
  });
};


/**
 * Create a new account.
 *
 * @example
 * ```javascript
 * var deglet = require('deglet-client');
 *
 * var data = deglet.keys.deriveKeys('some username', 'some password');
 * var client = new deglet.client.WalletClient(data.key.sign);
 * client.signup(data.payload, function(err, res) {
 *   console.log(err, res);
 * });
 * ```
 *
 * @param {object} payload
 */
WalletClient.prototype.signup = function(payload, cb) {
  var url = this.apiUrl + '/user/signup';
  return signedReq('POST', url, payload, this.sign, cb);
};


/**
 * Return the number of wallets stored by this user.
 */
WalletClient.prototype.walletCount = function(cb) {
  var url = this.apiUrl + '/user';
  return signedReq('POST', url, {count: 1}, this.sign, cb);
};


/**
 * Return the wallet blobs stored by this user.
 */
WalletClient.prototype.walletBlobs = function(encKey, cb) {
  var url = this.apiUrl + '/user';

  async.waterfall([

    async.apply(signedReq, 'POST', url, null, this.sign),

    function(res) {
      var result = res.map(function(raw) {
        raw.blob = store.decrypt(encKey, raw.blob);
        return raw;
      });
      return cb(null, result);
    }

  ]);
};


/**
 * Store the current wallet as an encrypted blob.
 *
 * @param {array} encKey - Encryption key
 * @param {function} cb  - Callback function
 */
WalletClient.prototype.walletStore = function(encKey, cb) {
  var plainWallet = this.bwc.export();
  var opts = {
    id: this.bwc.credentials.walletId,
    blob: store.encrypt(encKey, plainWallet),
    // Disallow blob updates after all signers have joined the wallet.
    maxchanges: this.bwc.credentials.n
  };
  var url = this.apiUrl + '/user/blob';

  signedReq('POST', url, opts, this.sign, cb);
};


/**
 * Create a new wallet by seeding from the wallet generation key.
 * The seed is taken from m/2'/<user wallet count + 1>'
 *
 * @example
 * ```javascript
 * var deglet = require('deglet-client');
 *
 * ...
 *
 * var client = new deglet.client.WalletClient(key.sign);
 * client.walletCreate(key.genWallet, {nrequired: 2, nsigners: 3}, cb);
 * ```
 *
 * @param {HDPrivateKey} genKey
 * @param {object} opts         - Define number of signers (nsigners), the
 *                                minimum amount of signers required (nsigners),
*                                 and the wallet name (walletName). Other
*                                 options are passed as is to BWC.
 * @param {function} cb         - Callback function
 * @returns {string}            - Secret to be shared among signers that
 *                                are expected to join the wallet.
 */
WalletClient.prototype.walletCreate = function(genKey, opts, cb) {
  var opts = opts || {};
  var walletName = opts.walletName || ("wallet" + util.randomHex(2));
  var signerName = "user" + util.randomHex(2);
  var m = opts.nrequired;
  var n = opts.nsigners;
  if (!m || !n) {
    throw new Error("nsigners and nrequired are both required");
  }
  delete opts['nsigners'];
  delete opts['nrequired'];
  delete opts['walletName'];

  async.waterfall([

    this.walletCount.bind(this),

    function(result, callback) {
      var count = result.num;  // Number of wallets created by this user.
      var key = genKey.derive(count + 1, true);
      this.bwc.seedFromExtendedPrivateKey(key.xprivkey);
      callback(null);  // Pass no results to the next function.
    }.bind(this),

    function(callback) {
      this.bwc.createWallet(walletName, signerName, m, n, opts, callback)
    }.bind(this),

    function(secret) {
      // Wallet created successfully.
      cb(null, secret);
    }

  ], function(err) {
    // Some error occurred in the process.
    cb(err, null);
  });
};


/**
 * Add a cosigner controlled by the server.
 *
 * @param {string} secret   - Secret required to join the active wallet.
 * @param {string} walletId - Optionally specify a wallet id different from
 *                            the active one.
 */
WalletClient.prototype.addSWCosigner = function(secret, walletId, cb) {
  var url = this.apiUrl + '/cosigner';
  var opts = {
    id: walletId || this.bwc.credentials.walletId,
    secret: secret
  };

  return signedReq('POST', url, opts, this.sign, cb);
};


/**
 * Get 1 or more addresses using the server controlled cosigner.
 *
 * @param {number} num      - Number of addresses to derive (default: 1).
 * @param {string} walletId - Optionally specify a wallet id different from
 *                            the active one.
 */
WalletClient.prototype.newAddress = function(num, walletId, cb) {
  var url = this.apiUrl + '/address';
  var opts = {
    id: walletId || this.bwc.credentials.walletId,
    num: num || 1
  };

  return signedReq('POST', url, opts, this.sign, cb);
};


WalletClient.prototype.balance = function(walletId, cb) {
  var url = this.apiUrl + '/balance';
  var opts = {
    id: walletId || this.bwc.credentials.walletId
  };

  return signedReq('POST', url, opts, this.sign, cb);
};


module.exports = {
  get: simpleGet,
  signedRequest: signedReq,
  WalletClient: WalletClient
};
