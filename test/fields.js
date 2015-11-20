var expect = require('chai').expect;
var deglet = require('..');

describe('Fields are present as expected', function() {

  it("should contain fields key and payload", function() {
    var data = deglet.keys.deriveKeys('some user', 'some pwd', 10002);
    expect(data).to.have.all.keys(['mnemonic', 'key', 'payload']);

    expect(data.payload).to.have.all.keys(
      ['username', 'check', 'iterations', 'salt']);
    expect(data.payload.username).to.be.equal('some user');
    expect(data.payload.iterations).to.be.equal(10002);

    expect(data.key).to.have.all.keys(['sign', 'encrypt', 'genWallet']);
    expect(data.key.sign.address).to.be.equal(
      data.key.sign.raw.publicKey.toAddress().toString());
  });

});
