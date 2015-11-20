var expect = require('chai').expect;
var deglet = require('..');

describe('Encrypt/Decrypt data', function() {

  it("should encrypt and decrypt using a string key", function() {
    var plaintext = "hello";
    var cipher = deglet.store.encrypt("hi", plaintext);
    var result = deglet.store.decrypt("hi", cipher);
    expect(plaintext).to.be.equal(result);
  });

  it("should encrypt and decrypt using a bit key", function() {
    var data = deglet.keys.deriveKeys("some user", "some pwd");
    var plaintext = "hello";
    var cipher = deglet.store.encrypt(data.key.encrypt, plaintext);
    var result = deglet.store.decrypt(data.key.encrypt, cipher);
    expect(plaintext).to.be.equal(result);

    var obj = JSON.parse(cipher);
    expect(obj.cipher).to.be.equal('aes');
    expect(obj.mode).to.be.equal('gcm');
    expect(obj.ks).to.be.equal(128);
    expect(obj.ts).to.be.equal(128);
  });

});
