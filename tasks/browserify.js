/*
* grunt-browserify
* https://github.com/jmreidy/grunt-browserify
*
* Copyright (c) 2013 Justin Reidy
* Licensed under the MIT license.
*/
'use strict';
var Runner = require('../lib/runner');
var path = require('path');
var async = require('async');
var browserify = require('browserify');
var browserifyIncremental = require('browserify-incremental');
var watchify = require('watchify');
var cache = require('../lib/cache').read();
var _ = require('lodash');

module.exports = Task;

function Task (grunt) {
  grunt.registerMultiTask('browserify', 'Grunt task for browserify.', function () {

    // set default options
    var options = this.options({
      banner: ''
    });

    var cacheData = _.clone(cache.all());
    cache.clean()
        .flush();

    async.each(this.files, function (file, next) {
      Task.runTask(grunt, options, cacheData, file, next);
    }, this.async());
  });
}

Task.runTask = function (grunt, options, cacheData, file, next) {
  var runner = new Runner({
    writer: grunt.file,
    logger: grunt,
    browserify: browserify,
    browserifyIncremental: browserifyIncremental,
    watchify: watchify,
    cacheData: cacheData
  });
  var files = grunt.file.expand({filter: 'isFile'}, file.src).map(function (f) {
    return path.resolve(f);
  });
  runner.run(files, file.dest, options, next);
};
