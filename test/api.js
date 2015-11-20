var expect = require('chai').expect;
var deglet = require('..');
var config = require('./config');

describe('API usage', function() {

  var wid;
  var localCli;
  var localData;
	var username;
	var pwd = 'some pwd';

	it("should create a new user", function(done) {
		username = 'user' + deglet.util.randomHex(1);
		var data = deglet.keys.deriveKeys(username, pwd);
		var cli = new deglet.client.WalletClient(
			data.key.sign,
      config.TEST_API_URL,
      {baseUrl: config.TEST_BWS_URL}
    );

    cli.signup(data.payload, function(err, res) {
      var exc = null;
      expect(err).to.be.null;
      expect(res).to.be.null;
      if (err) {
        exc = new Error(JSON.stringify(err));
      }
      done(exc);
    });
	});

  it("should fetch user data", function(done) {
    localCli = new deglet.client.WalletClient(
      null,
      config.TEST_API_URL,
      {baseUrl: config.TEST_BWS_URL}
    );
    localCli.loadLocalData(username, pwd, function(err, res) {
      localData = res;
      if (err) {
        err = new Error(JSON.stringify(err));
      }
      done(err);
    });
  });

  it("should have 0 wallets", function(done) {
    localCli.walletCount(function(err, res) {
      expect(res.num).to.be.equal(0);
      if (err) {
        err = new Error(JSON.stringify(err));
        return done(err);
      }

      localCli.walletBlobs(localData.key.sign, function(err, res) {
        expect(res).to.be.a('array');
        expect(res).to.have.length(0);
        if (err) {
          err = new Error(JSON.stringify(err));
        }
        done(err);
      });
    });
  });

  it("should create and store a wallet", function(done) {
    var opts = {
      nsigners: 3,
      nrequired: 2
    };
    var genKey = localData.key.genWallet;
    localCli.walletCreate(genKey, opts, function(err, secret) {
      if (err) {
        err = new Error(JSON.stringify(err));
        return done(err);
      }
      expect(secret).to.be.a('string');

      // The newly created wallet is stored internally and locally,
      // calling walletStore should store it in an encrypted format
      // on an external server.
      localCli.walletStore(localData.key.encrypt, function(err, res) {
        expect(res).to.have.all.keys(['blob', 'id', 'created_at']);
        expect(res.blob).to.be.a('string');
        expect(res.id).to.be.a('string');
        expect(res.created_at).to.be.a('number');
        wid = res.id;
        if (err) {
          err = new Error(JSON.stringify(err));
        }
        return done(err);
      });
    });
  });

  it("should have one wallet", function(done) {
    localCli.walletCount(function(err, res) {
      expect(res.num).to.be.equal(1);
      if (err) {
        err = new Error(JSON.stringify(err));
        return done(err);
      }

      localCli.walletBlobs(localData.key.encrypt, function(err, res) {
        expect(res).to.be.a('array');
        expect(res).to.have.length(1);
        expect(res[0].id).to.be.equal(wid);
        if (err) {
          err = new Error(JSON.stringify(err));
        }
        done(err);
      });
    });
  });

  it("should recover account from mnemonic", function() {
    var mnemonic = localData.mnemonic;
    var key = deglet.keys.recoverKeys(mnemonic);

    expect(key.encrypt).to.eql(localData.key.encrypt);
    expect(key.genWallet).to.be.equal(localData.key.genWallet);
    expect(key.sign.address).to.be.equal(localData.key.sign.address);
    expect(key.sign.key).to.be.equal(localData.key.sign.key);
    expect(key.sign.raw).to.be.equal(localData.key.sign.raw);
  });

  it("should create wallet with a given name", function(done) {
    var cli = new deglet.client.WalletClient(
      localData.key.sign,
      config.TEST_API_URL,
      {baseUrl: config.TEST_BWS_URL}
    );
    var opts = {nsigners: 1, nrequired: 1, walletName: 'hi wallet'};
    var genKey = localData.key.genWallet;

    cli.walletCreate(genKey, opts, function(err, secret) {
      if (err) {
        err = new Error(JSON.stringify(err));
        return done(err);
      }

      expect(secret).to.be.null; // 1-of-1 wallet, no secret to join it.
      var wallet = JSON.parse(cli.bwc.export());
      expect(wallet.walletName).to.be.equal('hi wallet');
      done();
    });
  });

  it("should fail to create a wallet after one is setup for the client", function(done) {
    localCli.walletCreate(
      localData.key.genWallet,
      {nsigners: 2, nrequired: 1},
      function(err, secret) {
        expect(secret).to.be.null;
        expect(err.code).to.be.equal('COPAYER_REGISTERED');
        done();
      }
    )
  });

  it("should enforce nsigners and nrequired", function() {
    var genKey = localData.key.genWallet;
    expect(function() { localCli.walletCreate(genKey, null) }).to.throw(
      'nsigners and nrequired are both required');
  });

});
