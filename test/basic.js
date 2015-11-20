var expect = require('chai').expect;
var deglet = require('..');

describe('Basic usage', function() {

  it("should create a JWS message and validate it", function() {
    var data = deglet.keys.deriveKeys('some user', 'some pwd');
    expect(data).to.have.property('key');
    expect(data).to.have.property('payload');

    var payload = {data: data.payload};
    var raw = deglet.auth.signSerialize(null, payload, data.key.sign);

    var decoded = deglet.auth.validateDeserialize(null, raw);
    expect(decoded).to.have.property("header");
    expect(decoded).to.have.property("payload");

    expect(decoded.header).to.have.property("kid");
    expect(decoded.header.kid).to.be.equal(data.key.sign.address);

    expect(decoded.payload).to.have.property("aud");
    expect(decoded.payload.aud).to.be.null;
  });

  it("should encrypt and decrypt a message", function() {
    var data = deglet.keys.deriveKeys('some user', 'some pwd');
    var encKey = data.key.encrypt;

    var plaintext = JSON.stringify(data);
    var ciphertext = deglet.store.encrypt(encKey, plaintext);
    var recovered = deglet.store.decrypt(encKey, ciphertext);
    expect(recovered).to.be.equal(plaintext);
  });

  it("should provide the same keys", function() {
    var data = deglet.keys.deriveKeys('some user', 'some pwd');
    var data2 = deglet.keys.deriveKeys(
      'some user', 'some pwd', data.payload.iterations, data.payload.salt);

    expect(data2.payload.salt).to.be.equal(data.payload.salt);
    expect(data2.key.address).to.be.equal(data.key.address);
    expect(data2.key.encKey).to.be.equal(data.key.encKey);
  });

});
