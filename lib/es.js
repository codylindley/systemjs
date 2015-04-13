/*
 * Extension to detect ES6 and auto-load Traceur or Babel for processing
 */
(function() {
  // good enough ES6 detection regex - format detections not designed to be accurate, but to handle the 99% use case
  var esRegEx = /(^\s*|[}\);\n]\s*)(import\s+(['"]|(\*\s+as\s+)?[^"'\(\)\n;]+\s+from\s+['"]|\{)|export\s+\*\s+from\s+["']|export\s+(\{|default|function|class|var|const|let|async\s+function))/;

  var traceurRuntimeRegEx = /\$traceurRuntime\s*\./;
  var babelHelpersRegEx = /babelHelpers\s*\./;

  // these should really be instance variables
  var transpilerNormalized, transpilerRuntimeNormalized;

  function setMetaGlobal(loader, name) {
    var meta = loader.meta[name] = loader.meta[name] || {};
    meta.format = meta.format || 'global';
    if (name === 'traceur')
      meta.exports = 'traceur';
  }

  hookConstructor(function(constructor) {
    return function() {
      var loader = this;
      constructor.call(this);

      setMetaGlobal(loader, 'babel');
      setMetaGlobal(loader, 'traceur');
      setMetaGlobal(loader, 'traceur-runtime');
      setMetaGlobal(loader, 'babel/external-helpers');
    };
  });

  hook('translate', function(translate) {
    return function(load) {
      var loader = this;
      return translate.call(loader, load)
      .then(function(source) {
        if (load.metadata.format === 'es6')
          throw new TypeError(load.name + ' has been configured to use the "es6" module format, which has been renamed to "es".'
              + '\n\tSet `System.meta["' + load.name + '"] = {format: "es"}` to resolve this.');
        // detect ES6
        if (load.metadata.format == 'es' || !load.metadata.format && source.match(esRegEx)) {
          load.metadata.format = 'system';
          return transpile.call(loader, load);
        }

        if (load.metadata.format == 'system') {
          if (!__global.$traceurRuntime && load.source.match(traceurRuntimeRegEx)) {
            return loader['import']('traceur-runtime').then(function() {
              return source;
            });
          }
          if (!__global.babelHelpers && load.source.match(babelHelpersRegEx)) {
            return loader['import']('babel/external-helpers').then(function() {
              return source;
            });
          }
        }

        // ensure Traceur doesn't clobber the System global
        if (loader.transpiler == 'traceur')
          return Promise.all([
            transpilerNormalized || (transpilerNormalized = loader.normalize(loader.transpiler)),
            transpilerRuntimeNormalized || (transpilerRuntimeNormalized = loader.normalize(loader.transpiler + '-runtime'))
          ])
          .then(function(normalized) {
            if (load.name == normalized[0] || load.name == normalized[1])
              return '(function() { var curSystem = System; ' + source + '\nSystem = curSystem; })();';

            return source;
          });

        return source;
      });
    };
  });

})();
