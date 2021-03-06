var _ = require('lodash');
var path = require('path');
var resolve = require('resolve');
var glob = require('glob');
var fs = require('fs');
var crypto = require('crypto');
var cache = require('./cache').read();

module.exports = GruntBrowserifyRunner;

function GruntBrowserifyRunner(options) {
    this.browserify = options.browserify;
    this.browserifyIncremental = options.browserifyIncremental;
    this.watchify = options.watchify;
    this.logger = options.logger;
    this.writer = options.writer;
    this.cacheData = options.cacheData;
    this.firstBuild = true;
}

GruntBrowserifyRunner.prototype = _.create(GruntBrowserifyRunner.prototype, {
    run: function (files, destination, options, next) {
        var self = this;

        var destPath = this.createDestDir(destination);
        var keepAlive = this.keepAliveFn.bind(this, destination);
        var done = options.keepAlive ? keepAlive : next;
        var bundleComplete = this.onBundleComplete(destination, options, done);
        // Previously bundled files will be registrated in cache
        var isFileInCache = checkInCache(this.cacheData, destination);

        //TODO: add tests
        // Filter files which start from _
        if (options.filterUnderscore) {
            files = files.filter(function (el) {
                var match = /([^\/]+)\.\w+$/.exec(destination);
                return match &&
                    match.length > 0 && !/^_/.test(match[0]);
            });
        }

        //TODO: add tests
        // Prevents building process if sources did not change
        if (options.filterUnchanged) {
            var inputModified = -1;
            var outputModified = fs.existsSync(destination) ? Date.parse(fs.statSync(destination).mtime) : -1;
            files.forEach(function (file) {
                inputModified = Math.max(Date.parse(fs.statSync(file).mtime), inputModified);
            });

            if (outputModified > inputModified) {
                bundleComplete();
                return;
            }
        }

        //TODO: add tests
        //TODO: make async read of files
        // Filter files with no require method within
        if (options.filterNoRequire && !(isFileInCache && options.stopFilteringOnPrevious)) {

            files = files.filter(function (el) {
                return /(\b|^|\n|\W)require\(/.test(fs.readFileSync(el).toString());
            });
        }

        // If we do not have files we should not do compilation
        if (options.refuseEmptyInput && files.length < 1) {
            bundleComplete();
            return;
        }

        //set constructor options and instantiate
        var bOpts = _.cloneDeep(options.browserifyOptions) || {};
        bOpts.entries = bOpts.entries || files;

        // watchify options
        var wOpts = options.watchifyOptions || {};

        // Watchify requires specific arguments
        if (options.watch) {
            bOpts = _.extend({cache: {}, packageCache: {}, fullPaths: true}, bOpts);
        }

        // Create multiple caches for different files
        if (options.incremental && bOpts.cacheDir) {
            var match = /([^\/]+)\.\w+$/.exec(destination);
            var fname = match ? match[0] : destination;
            var fnameHash = crypto.createHash('md5').update(fname).digest('hex').substr(0, 16) + "_" + fname;

            bOpts.cacheFile = bOpts.cacheDir +
            (/(\\|\/)$/.test(bOpts.cacheDir) ? '' : '/') +
            fnameHash + '.json';
        }

        if (bOpts.cacheFile) {
            var dir = path.dirname(bOpts.cacheFile);

            if (!fs.existsSync(dir)) {
                fs.mkdir(dir);
            }
        }

        //TODO: add test for browserifyIncremental
        //determine watchify or browserify, or browserifyIncremental
        var b = options.watch ? this.watchify(this.browserify(bOpts), wOpts) :
            options.incremental ? this.browserifyIncremental(bOpts) :
                this.browserify(bOpts);

        b.on('error', function (err) {
            self.logger.fail.warn(err);
        });

        if (options.bundleOptions) {
            throw new Error('bundleOptions is no longer used. Move all option in browserifyOptions.');
        }

        if (options.alias) {
            if (_.isPlainObject(options.alias)) {
                for (var alias in options.alias) {
                    b.require(options.alias[alias], {expose: alias});
                }
            }
            else {
                requireFiles(b, options.alias);
            }
        }

        if (options.require) {
            requireFiles(b, options.require);
        }

        if (options.exclude) {
            _.forEach(options.exclude, function (file) {
                runOptionForGlob(b, 'exclude', file);
            });
        }

        if (options.ignore) {
            _.forEach(options.ignore, function (file) {
                runOptionForGlob(b, 'ignore', file);
            });
        }

        if (options.external) {
            // allow externalizing of alias object
            if (_.isPlainObject(options.external)) {
                for (var id in options.external) {
                    if (testForGlob(id)) {
                        runOptionForGlob(b, 'external', id);
                    }
                    else {
                        b.external(id);
                    }
                }
            }
            else {
                _.forEach(options.external, function (id) {
                    //allow externalizing of require lists
                    if (id.match(':')) {
                        id = id.split(':')[1];
                    }

                    if (testForGlob(id)) {
                        runOptionForGlob(b, 'external', id);
                    }
                    else {
                        b.external(id);
                    }
                });
            }
        }

        if (options.transform) {
            _.forEach(options.transform, function (transformer) {
                if (typeof transformer !== 'object') {
                    b.transform(transformer);
                }
                else {
                    b.transform(transformer[1], transformer[0]);
                }
            });
        }

        if (options.plugin) {
            _.forEach(options.plugin, function (plugin) {
                if (typeof plugin !== 'object') {
                    b.plugin(plugin);
                }
                else {
                    b.plugin(plugin[0], plugin[1]);
                }
            });
        }

        if (options.watch) {
            var bundleUpdate = this.onBundleComplete(destination, options, keepAlive);
            b.on('update', function (ids) {
                ids.forEach(function (id) {
                    self.logger.log.ok(id.cyan + ' changed, updating bundle.');
                });
                doBundle(b, options, bundleUpdate);
            });
        }

        if (options.configure) {
            options.configure(b);
        }

        doBundle(b, options, bundleComplete);
    },

    createDestDir: function (destination) {
        var destPath = path.dirname(path.resolve(destination));
        if (!this.writer.exists(destPath)) {
            this.writer.mkdir(destPath);
        }
        return destPath;
    },

    keepAliveFn: function (destination) {
        //this.logger.log.ok('Watchifying...');
    },

    onBundleComplete: function (destination, options, next) {
        var self = this;

        return function (err, buf) {
            if (err) {
                self.logger.log.error(err);
                if (self.firstBuild || !options.keepAlive) {
                    self.logger.fail.warn('Error running grunt-browserify.');
                }
            }
            else if (buf) {
                // prepend the banner
                if (options.banner) {
                    buf = Buffer.concat([new Buffer(options.banner + '\n', 'utf8'), buf]);
                }

                cache.add('previous', destination);
                cache.flush();

                self.logger.log.ok('Bundle ' + destination.cyan + ' created. ' + (options.keepAlive ? 'Watchifying...' : ''));
                self.writer.write(destination, buf);
            }

            self.firstBuild = false;
            next();
        };
    }
});

function doBundle(browserifyInstance, opts, bundleComplete) {
    if (opts.preBundleCB) {
        opts.preBundleCB(browserifyInstance);
    }

    browserifyInstance.bundle(function (err, buf) {
        if (opts.postBundleCB) {
            opts.postBundleCB(err, buf, bundleComplete);
        }
        else {
            bundleComplete(err, buf);
        }
    });
}

function testForGlob(id) {
    return (/\*/.test(id));
}

function runOptionForGlob(browserifyInstance, method, pattern) {
    var files = glob.sync(pattern);
    if (!files || files.length < 1) {
        //it's not a glob, it's a file / module path
        files = [pattern];
    }
    files.forEach(function (f) {
        browserifyInstance[method].call(browserifyInstance, f);
    });
}

function requireFiles(b, requiredFiles) {
    _.forEach(requiredFiles, function (file) {
        var filePath, opts;
        if (Array.isArray(file)) {
            filePath = file[0];
            opts = file[1];
        }
        else {
            var filePair = file.split(':');
            filePath = filePair[0];
            opts = {
                expose: filePair.length === 1 ? filePair[0] : filePair[1]
            };
        }
        b.require(filePath, opts);
    });
}

function checkInCache(cacheData, file) {
    return cacheData &&
        cacheData.hasOwnProperty('previous') &&
        cacheData['previous'].indexOf(file) > -1;
};