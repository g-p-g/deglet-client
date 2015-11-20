var expect = require('chai').expect;
var deglet = require('..');

describe('Bad data', function() {

  var raw;

  beforeEach(function() {
    var data = deglet.keys.deriveKeys('some user', 'some pwd');
    var payload = {data: data.payload};
    raw = deglet.auth.signSerialize(null, payload, data.key.sign);
  });

  it("should fail to decode a message missing segments", function() {
    /* Empty message. */
    expect(deglet.auth.validateDeserialize).to.throw(TypeError);

    var f = function() {
      var pieces = raw.split('.');
      deglet.auth.validateDeserialize(null, pieces[0] + '.' + pieces[1]);
    };
    expect(f).to.throw(TypeError);
  });

  it("should fail to decode with an invalid header", function() {
    var f = function() {
      var pieces = raw.split('.');
      deglet.auth.validateDeserialize(
        null, pieces[1] + '.' + pieces[1] + '.' + pieces[2]);
    };
    expect(f).to.throw(TypeError);
  });

  it("should fail to decode when the signature is invalid", function() {
    var data2 = deglet.keys.deriveKeys('someone', 'else');
    var payload = {data: data2.payload};
    var raw2 = deglet.auth.signSerialize(null, payload, data2.key.sign);

    var f = function() {
      var pieces = raw.split('.');
      var pieces2 = raw2.split('.');
      /* Use the second signature in the first message. */
      deglet.auth.validateDeserialize(
        null, pieces[0] + '.' + pieces[1] + '.' + pieces2[2]);
    };
    expect(f).to.throw(Error);
  });

  it("should fail when audience does not match", function() {
    var f = function() {
      deglet.auth.validateDeserialize('hello', raw);
    };
    expect(f).to.throw(Error);
  });

  it("should fail when payload has expired", function() {
    var data = deglet.keys.deriveKeys('some user', 'some pwd');
    var payload = {data: data.payload, exp: 0};
    var raw = deglet.auth.signSerialize(null, payload, data.key.sign);


    var f = function() {
      deglet.auth.validateDeserialize(null, raw);
    };
    expect(f).to.throw(Error);
  });

  it("should fail to generate less than 1 random word", function() {
    expect(function() { deglet.util.randomHex(0) }).to.throw("numWords < 1");
  });

  it("should fail to convert an invalid key", function() {
    expect(function() { deglet.keys.keyToBuffer([123]) }).to.throw(
      "Unexpected length");
  });

});
