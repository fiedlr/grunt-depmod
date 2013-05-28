/*global node:true*/
/*
 * grunt-depmod-tracker
 *
 * Copyright (c) 2013 GoodData Corporation
 */
module.exports = function (grunt) {

    var deps = {
        _files: {},
        _mods: {},
        _depmod: require('../lib/esprima-depmod'),
        _processName: null,

        init: function(patterns, options) {
            // configurables
            this._processName = options.processName;
            this._aliases = options.aliases;
            this._fs = options.fs;

            // initial dep parse
            grunt.file.expand(patterns).forEach(function(fn) {
                this.merge(fn);
            }, this);
        },

        dispose: function(filepath) {
            var mods = this._files[filepath] || {};
            Object.keys(mods).forEach(function(k) {
                console.log('dispose module', this._mods[k], k);
                delete this._mods[k];
            }, this);
            delete this._files[filepath];
        },

        merge: function(filepath) {
             var mods = this._depmod.getDepmod([filepath], {
                 processName: this._processName,
                 aliases: this._aliases,
                 fs: this._fs
             });
             this._files[filepath] = mods;
             this.mergeMods(mods, filepath);
        },

        mergeMods: function(mods, filepath) {
             Object.keys(mods).forEach(function(k) {
                 this._mods[k] = mods[k];
                 // file path... FIXME? not accurate for multiple mods per file
                 this._files[mods[k].path] = mods[k];
                 // console.log('merge module', k, mods[k]);
             }, this);
        },

        update: function(filepath) {
            this.dispose(filepath);
            this.merge(filepath);
        },

        resolveDependencies: function(modName) {
            return this._depmod.resolve(this._mods, modName);
        }
    };

    // export the interface
    grunt.depmod_tracker = {
        resolveDependencies: deps.resolveDependencies.bind(deps)
    };

    grunt.registerMultiTask('depmod-tracker', 'Resolve dependencies.', function () {
      this.files.forEach(function(f) {
          var options = this.options({
               /**
                * The modules information file pathname which was created as the
                * outputFile of the 'depmod' task.
                * @type {string}
                */
               modulesInfo: f.modulesInfo,

               processName: f.processName
          });

          var fs = options.fs;

          grunt.event.on('watch', function(action, filepath) {
              console.log('watch:tracker', filepath);

              // drop the file from the caching filesystem
              fs && fs.invalidate && fs.invalidate(filepath);

              // invalidate old dependencies and resolve new ones
              deps.update(filepath);
          });

          // parse the deps of the watched files now
          deps.init(f.src, {
              processName: options.processName,
              aliases: options.aliases,
              fs: fs
          });

          // static init of the slowly changing dependencies (lib/**/*.js)
          options.modulesInfo && options.modulesInfo.forEach(function(depmodFile) {
              deps.mergeMods(JSON.parse(grunt.file.read(depmodFile)));
          });
      }, this);
  });

};
