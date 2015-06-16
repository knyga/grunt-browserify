/* global beforeEach, describe, context, it */
'use strict';
var assert = require('assert');
var cache = require('../lib/cache');
var _ = require('lodash');

describe('cache', function () {

    beforeEach(function () {
        cache._path = './test/fixtures/cache/cache.json';
        cache._data = {
            name: 'knyga'
        };
        cache.flush();
    });

    it('read value', function (done) {
        assert.equal(cache.get('name'), 'knyga');
        done();
    });

    it('set value', function (done) {
        cache.set('past', 'juline');
        assert.equal(cache.get('past'), 'juline');
        done();
    });

    it('add value', function (done) {
        cache.set('arr', []);
        assert.equal(cache.get('arr').length, 0);
        cache.add('arr', 'something');
        assert.equal(cache.get('arr').length, 1);
        done();
    });

    it('add value to empty arr', function (done) {
        cache.add('arr', 'something');
        assert.equal(cache.get('arr').length, 1);
        done();
    });

    it('write value', function (done) {
        cache.set('rabbit', 'white');
        cache.flush();
        cache.clean();
        cache.read();
        assert.equal(cache.get('rabbit'), 'white');
        done();
    });

});