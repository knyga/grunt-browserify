var fs = require('fs');
var path = require('path');

//TODO: cover with tests
module.exports = {
    _path: __dirname + '/../_cache/cache.json',
    _data: {},
    flush: function() {
        var dir = path.dirname(this._path);

        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir);
        }

        fs.writeFileSync(this._path, JSON.stringify(this._data));

        return this;
    },
    read: function() {
        if(fs.existsSync(this._path)) {
           this._data = JSON.parse(fs.readFileSync(this._path, 'utf8'));
        }

        return this;
    },
    set: function(name, value) {
        this._data[name] = value;

        return this;
    },
    add: function(name, value) {
        if(!this._data.hasOwnProperty(name)) {
            this._data[name] = [];
        }

        this._data[name].push(value);

        return this;
    },
    get: function(name) {
        return this._data[name];
    },
    all: function() {
        return this._data;
    },
    clean: function(name) {
        this._data = {};

        return this;
    }
};