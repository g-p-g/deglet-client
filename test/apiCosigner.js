var expect = require('chai').expect;
var deglet = require('..');
var config = require('./config');

describe('API usage with a server-side cosigner', function() {

  var wallet;
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

  it("should create and store a wallet", function(done) {
    var opts = {
      nsigners: 2,
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
        wallet = {id: res.id, secret: secret};
        if (err) {
          err = new Error(JSON.stringify(err));
        }
        return done(err);
      });
    });
  });

  it("should fail as the cosigner is not present", function(done) {
    localCli.balance(wallet.id, function(err, res) {
      expect(res).to.be.null;
      expect(err.code).to.be.equal(404);
      expect(err.error).to.be.equal('cosigner not found for this wallet');
      done();
    });
  });

  it("should add a cosigner", function(done) {
    localCli.addSWCosigner(wallet.secret, wallet.id, function(err, res) {
      if (err) {
        err = new Error(JSON.stringify(err));
        return done(err);
      }
      expect(res).to.be.null;
      done();
    });
  });

  it("should derive 1 address", function(done) {
    localCli.newAddress(1, wallet.id, function(err, res) {
      if (err) {
        err = new Error(JSON.stringify(err));
        return done(err);
      }
      expect(res).to.have.all.keys(['address', 'path', 'createdOn', 'walletId']);
      expect(res.walletId).to.be.equal(wallet.id);
      done();
    });
  });

  it("should derive 2 address", function(done) {
    localCli.newAddress(2, wallet.id, function(err, res) {
      if (err) {
        err = new Error(JSON.stringify(err));
        return done(err);
      }
      expect(res).to.have.all.keys(['walletId', 'result']);
      expect(res.walletId).to.be.equal(wallet.id);
      expect(res.result).to.be.a('array');
      expect(res.result.length).to.be.equal(2);
      expect(res.result[0]).to.have.all.keys(['address', 'path', 'createdOn']);
      done();
    });
  });

});
