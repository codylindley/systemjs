/*
 * SystemJS v0.16.7
 */
(function() {
function bootstrap() {(function(__global) {

  var isWorker = typeof self !== 'undefined' && typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;
  var isBrowser = typeof window != 'undefined' && !isWorker;
  var isWindows = typeof process != 'undefined' && !!process.platform.match(/^win/);

  if (__global.console)
    console.assert = console.assert || function() {};

  // IE8 support
  var indexOf = Array.prototype.indexOf || function(item) {
    for (var i = 0, thisLen = this.length; i < thisLen; i++) {
      if (this[i] === item) {
        return i;
      }
    }
    return -1;
  };
  
  var defineProperty;
  (function () {
    try {
      if (!!Object.defineProperty({}, 'a', {}))
        defineProperty = Object.defineProperty;
    }
    catch (e) {
      defineProperty = function(obj, prop, opt) {
        try {
          obj[prop] = opt.value || opt.get.call(obj);
        }
        catch(e) {}
      }
    }
  })();

  function addToError(err, msg) {
    var newErr;
    if (err instanceof Error) {
      var newErr = new err.constructor(err.message, err.fileName, err.lineNumber);
      newErr.message = err.message + '\n\t' + msg;
      newErr.stack = err.stack;
    }
    else {
      newErr = err + '\n\t' + msg;
    }
      
    return newErr;
  }

  function __eval(source, debugName, context) {
    try {
      new Function(source).call(context);
    }
    catch(e) {
      throw addToError(e, 'Evaluating ' + debugName);
    }
  }
/*
*********************************************************************************************

  Dynamic Module Loader Polyfill

    - Implemented exactly to the former 2014-08-24 ES6 Specification Draft Rev 27, Section 15
      http://wiki.ecmascript.org/doku.php?id=harmony:specification_drafts#august_24_2014_draft_rev_27

    - Functions are commented with their spec numbers, with spec differences commented.

    - Spec bugs are commented in this code with links.

    - Abstract functions have been combined where possible, and their associated functions
      commented.

    - Realm implementation is entirely omitted.

*********************************************************************************************
*/

function Module() {}
function Loader(options) {
  options = options || {};

  if (options.normalize)
    this.normalize = options.normalize;
  if (options.locate)
    this.locate = options.locate;
  if (options.fetch)
    this.fetch = options.fetch;
  if (options.translate)
    this.translate = options.translate;
  if (options.instantiate)
    this.instantiate = options.instantiate;

  this._loader = {
    loaderObj: this,
    loads: [],
    modules: {},
    importPromises: {},
    moduleRecords: {}
  };

  // 26.3.3.6
  defineProperty(this, 'global', {
    get: function() {
      return __global;
    }
  });

  // 26.3.3.13 realm not implemented

  if (this.transpiler)
    setupTranspilers(this);
}

(function() {

// Some Helpers

// logs a linkset snapshot for debugging
/* function snapshot(loader) {
  console.log('---Snapshot---');
  for (var i = 0; i < loader.loads.length; i++) {
    var load = loader.loads[i];
    var linkSetLog = '  ' + load.name + ' (' + load.status + '): ';

    for (var j = 0; j < load.linkSets.length; j++) {
      linkSetLog += '{' + logloads(load.linkSets[j].loads) + '} ';
    }
    console.log(linkSetLog);
  }
  console.log('');
}
function logloads(loads) {
  var log = '';
  for (var k = 0; k < loads.length; k++)
    log += loads[k].name + (k != loads.length - 1 ? ' ' : '');
  return log;
} */


/* function checkInvariants() {
  // see https://bugs.ecmascript.org/show_bug.cgi?id=2603#c1

  var loads = System._loader.loads;
  var linkSets = [];

  for (var i = 0; i < loads.length; i++) {
    var load = loads[i];
    console.assert(load.status == 'loading' || load.status == 'loaded', 'Each load is loading or loaded');

    for (var j = 0; j < load.linkSets.length; j++) {
      var linkSet = load.linkSets[j];

      for (var k = 0; k < linkSet.loads.length; k++)
        console.assert(loads.indexOf(linkSet.loads[k]) != -1, 'linkSet loads are a subset of loader loads');

      if (linkSets.indexOf(linkSet) == -1)
        linkSets.push(linkSet);
    }
  }

  for (var i = 0; i < loads.length; i++) {
    var load = loads[i];
    for (var j = 0; j < linkSets.length; j++) {
      var linkSet = linkSets[j];

      if (linkSet.loads.indexOf(load) != -1)
        console.assert(load.linkSets.indexOf(linkSet) != -1, 'linkSet contains load -> load contains linkSet');

      if (load.linkSets.indexOf(linkSet) != -1)
        console.assert(linkSet.loads.indexOf(load) != -1, 'load contains linkSet -> linkSet contains load');
    }
  }

  for (var i = 0; i < linkSets.length; i++) {
    var linkSet = linkSets[i];
    for (var j = 0; j < linkSet.loads.length; j++) {
      var load = linkSet.loads[j];

      for (var k = 0; k < load.dependencies.length; k++) {
        var depName = load.dependencies[k].value;
        var depLoad;
        for (var l = 0; l < loads.length; l++) {
          if (loads[l].name != depName)
            continue;
          depLoad = loads[l];
          break;
        }

        // loading records are allowed not to have their dependencies yet
        // if (load.status != 'loading')
        //  console.assert(depLoad, 'depLoad found');

        // console.assert(linkSet.loads.indexOf(depLoad) != -1, 'linkset contains all dependencies');
      }
    }
  }
} */

  // 15.2.3 - Runtime Semantics: Loader State

  // 15.2.3.11
  function createLoaderLoad(object) {
    return {
      // modules is an object for ES5 implementation
      modules: {},
      loads: [],
      loaderObj: object
    };
  }

  // 15.2.3.2 Load Records and LoadRequest Objects

  // 15.2.3.2.1
  function createLoad(name) {
    return {
      status: 'loading',
      name: name,
      linkSets: [],
      dependencies: [],
      metadata: {}
    };
  }

  // 15.2.3.2.2 createLoadRequestObject, absorbed into calling functions

  // 15.2.4

  // 15.2.4.1
  function loadModule(loader, name, options) {
    return new Promise(asyncStartLoadPartwayThrough({
      step: options.address ? 'fetch' : 'locate',
      loader: loader,
      moduleName: name,
      // allow metadata for import https://bugs.ecmascript.org/show_bug.cgi?id=3091
      moduleMetadata: options && options.metadata || {},
      moduleSource: options.source,
      moduleAddress: options.address
    }));
  }

  // 15.2.4.2
  function requestLoad(loader, request, refererName, refererAddress) {
    // 15.2.4.2.1 CallNormalize
    return new Promise(function(resolve, reject) {
      resolve(loader.loaderObj.normalize(request, refererName, refererAddress));
    })
    // 15.2.4.2.2 GetOrCreateLoad
    .then(function(name) {
      var load;
      if (loader.modules[name]) {
        load = createLoad(name);
        load.status = 'linked';
        // https://bugs.ecmascript.org/show_bug.cgi?id=2795
        load.module = loader.modules[name];
        return load;
      }

      for (var i = 0, l = loader.loads.length; i < l; i++) {
        load = loader.loads[i];
        if (load.name != name)
          continue;
        console.assert(load.status == 'loading' || load.status == 'loaded', 'loading or loaded');
        return load;
      }

      load = createLoad(name);
      loader.loads.push(load);

      proceedToLocate(loader, load);

      return load;
    });
  }

  // 15.2.4.3
  function proceedToLocate(loader, load) {
    proceedToFetch(loader, load,
      Promise.resolve()
      // 15.2.4.3.1 CallLocate
      .then(function() {
        return loader.loaderObj.locate({ name: load.name, metadata: load.metadata });
      })
    );
  }

  // 15.2.4.4
  function proceedToFetch(loader, load, p) {
    proceedToTranslate(loader, load,
      p
      // 15.2.4.4.1 CallFetch
      .then(function(address) {
        // adjusted, see https://bugs.ecmascript.org/show_bug.cgi?id=2602
        if (load.status != 'loading')
          return;
        load.address = address;

        return loader.loaderObj.fetch({ name: load.name, metadata: load.metadata, address: address });
      })
    );
  }

  var anonCnt = 0;

  // 15.2.4.5
  function proceedToTranslate(loader, load, p) {
    p
    // 15.2.4.5.1 CallTranslate
    .then(function(source) {
      if (load.status != 'loading')
        return;

      return Promise.resolve(loader.loaderObj.translate({ name: load.name, metadata: load.metadata, address: load.address, source: source }))

      // 15.2.4.5.2 CallInstantiate
      .then(function(source) {
        load.source = source;
        return loader.loaderObj.instantiate({ name: load.name, metadata: load.metadata, address: load.address, source: source });
      })

      // 15.2.4.5.3 InstantiateSucceeded
      .then(function(instantiateResult) {
        if (instantiateResult === undefined) {
          load.address = load.address || '<Anonymous Module ' + ++anonCnt + '>';

          // instead of load.kind, use load.isDeclarative
          load.isDeclarative = true;
          return transpile.call(loader.loaderObj, load)
          .then(function(transpiled) {
            // Hijack System.register to set declare function
            var curSystem = __global.System;
            var curRegister = curSystem.register;
            curSystem.register = function(name, deps, declare) {
              if (typeof name != 'string') {
                declare = deps;
                deps = name;
              }
              // store the registered declaration as load.declare
              // store the deps as load.deps
              load.declare = declare;
              load.depsList = deps;
            }
            // empty {} context is closest to undefined 'this' we can get
            __eval(transpiled, load.address, {});
            curSystem.register = curRegister;
          });
        }
        else if (typeof instantiateResult == 'object') {
          load.depsList = instantiateResult.deps || [];
          load.execute = instantiateResult.execute;
          load.isDeclarative = false;
        }
        else
          throw TypeError('Invalid instantiate return value');
      })
      // 15.2.4.6 ProcessLoadDependencies
      .then(function() {
        load.dependencies = [];
        var depsList = load.depsList;

        var loadPromises = [];
        for (var i = 0, l = depsList.length; i < l; i++) (function(request, index) {
          loadPromises.push(
            requestLoad(loader, request, load.name, load.address)

            // 15.2.4.6.1 AddDependencyLoad (load is parentLoad)
            .then(function(depLoad) {

              // adjusted from spec to maintain dependency order
              // this is due to the System.register internal implementation needs
              load.dependencies[index] = {
                key: request,
                value: depLoad.name
              };

              if (depLoad.status != 'linked') {
                var linkSets = load.linkSets.concat([]);
                for (var i = 0, l = linkSets.length; i < l; i++)
                  addLoadToLinkSet(linkSets[i], depLoad);
              }

              // console.log('AddDependencyLoad ' + depLoad.name + ' for ' + load.name);
              // snapshot(loader);
            })
          );
        })(depsList[i], i);

        return Promise.all(loadPromises);
      })

      // 15.2.4.6.2 LoadSucceeded
      .then(function() {
        // console.log('LoadSucceeded ' + load.name);
        // snapshot(loader);

        console.assert(load.status == 'loading', 'is loading');

        load.status = 'loaded';

        var linkSets = load.linkSets.concat([]);
        for (var i = 0, l = linkSets.length; i < l; i++)
          updateLinkSetOnLoad(linkSets[i], load);
      });
    })
    // 15.2.4.5.4 LoadFailed
    ['catch'](function(exc) {
      load.status = 'failed';
      load.exception = exc;

      var linkSets = load.linkSets.concat([]);
      for (var i = 0, l = linkSets.length; i < l; i++) {
        linkSetFailed(linkSets[i], load, exc);
      }

      console.assert(load.linkSets.length == 0, 'linkSets not removed');
    });
  }

  // 15.2.4.7 PromiseOfStartLoadPartwayThrough absorbed into calling functions

  // 15.2.4.7.1
  function asyncStartLoadPartwayThrough(stepState) {
    return function(resolve, reject) {
      var loader = stepState.loader;
      var name = stepState.moduleName;
      var step = stepState.step;

      if (loader.modules[name])
        throw new TypeError('"' + name + '" already exists in the module table');

      // adjusted to pick up existing loads
      var existingLoad;
      for (var i = 0, l = loader.loads.length; i < l; i++) {
        if (loader.loads[i].name == name) {
          existingLoad = loader.loads[i];

          if(step == 'translate' && !existingLoad.source) {
            existingLoad.address = stepState.moduleAddress;
            proceedToTranslate(loader, existingLoad, Promise.resolve(stepState.moduleSource));
          }

          return existingLoad.linkSets[0].done.then(function() {
            resolve(existingLoad);
          });
        }
      }

      var load = createLoad(name);

      load.metadata = stepState.moduleMetadata;

      var linkSet = createLinkSet(loader, load);

      loader.loads.push(load);

      resolve(linkSet.done);

      if (step == 'locate')
        proceedToLocate(loader, load);

      else if (step == 'fetch')
        proceedToFetch(loader, load, Promise.resolve(stepState.moduleAddress));

      else {
        console.assert(step == 'translate', 'translate step');
        load.address = stepState.moduleAddress;
        proceedToTranslate(loader, load, Promise.resolve(stepState.moduleSource));
      }
    }
  }

  // Declarative linking functions run through alternative implementation:
  // 15.2.5.1.1 CreateModuleLinkageRecord not implemented
  // 15.2.5.1.2 LookupExport not implemented
  // 15.2.5.1.3 LookupModuleDependency not implemented

  // 15.2.5.2.1
  function createLinkSet(loader, startingLoad) {
    var linkSet = {
      loader: loader,
      loads: [],
      startingLoad: startingLoad, // added see spec bug https://bugs.ecmascript.org/show_bug.cgi?id=2995
      loadingCount: 0
    };
    linkSet.done = new Promise(function(resolve, reject) {
      linkSet.resolve = resolve;
      linkSet.reject = reject;
    });
    addLoadToLinkSet(linkSet, startingLoad);
    return linkSet;
  }
  // 15.2.5.2.2
  function addLoadToLinkSet(linkSet, load) {
    console.assert(load.status == 'loading' || load.status == 'loaded', 'loading or loaded on link set');

    for (var i = 0, l = linkSet.loads.length; i < l; i++)
      if (linkSet.loads[i] == load)
        return;

    linkSet.loads.push(load);
    load.linkSets.push(linkSet);

    // adjustment, see https://bugs.ecmascript.org/show_bug.cgi?id=2603
    if (load.status != 'loaded') {
      linkSet.loadingCount++;
    }

    var loader = linkSet.loader;

    for (var i = 0, l = load.dependencies.length; i < l; i++) {
      var name = load.dependencies[i].value;

      if (loader.modules[name])
        continue;

      for (var j = 0, d = loader.loads.length; j < d; j++) {
        if (loader.loads[j].name != name)
          continue;

        addLoadToLinkSet(linkSet, loader.loads[j]);
        break;
      }
    }
    // console.log('add to linkset ' + load.name);
    // snapshot(linkSet.loader);
  }

  // linking errors can be generic or load-specific
  // this is necessary for debugging info
  function doLink(linkSet) {
    var error = false;
    try {
      link(linkSet, function(load, exc) {
        linkSetFailed(linkSet, load, exc);
        error = true;
      });
    }
    catch(e) {
      linkSetFailed(linkSet, null, e);
      error = true;
    }
    return error;
  }

  // 15.2.5.2.3
  function updateLinkSetOnLoad(linkSet, load) {
    // console.log('update linkset on load ' + load.name);
    // snapshot(linkSet.loader);

    console.assert(load.status == 'loaded' || load.status == 'linked', 'loaded or linked');

    linkSet.loadingCount--;

    if (linkSet.loadingCount > 0)
      return;

    // adjusted for spec bug https://bugs.ecmascript.org/show_bug.cgi?id=2995
    var startingLoad = linkSet.startingLoad;

    // non-executing link variation for loader tracing
    // on the server. Not in spec.
    /***/
    if (linkSet.loader.loaderObj.execute === false) {
      var loads = [].concat(linkSet.loads);
      for (var i = 0, l = loads.length; i < l; i++) {
        var load = loads[i];
        load.module = !load.isDeclarative ? {
          module: _newModule({})
        } : {
          name: load.name,
          module: _newModule({}),
          evaluated: true
        };
        load.status = 'linked';
        finishLoad(linkSet.loader, load);
      }
      return linkSet.resolve(startingLoad);
    }
    /***/

    var abrupt = doLink(linkSet);

    if (abrupt)
      return;

    console.assert(linkSet.loads.length == 0, 'loads cleared');

    linkSet.resolve(startingLoad);
  }

  // 15.2.5.2.4
  function linkSetFailed(linkSet, load, exc) {
    var loader = linkSet.loader;

    if (load) {
      if (load && linkSet.loads[0].name != load.name)
        exc = addToError(exc, 'Error loading "' + load.name + '" from "' + linkSet.loads[0].name + '" at ' + (linkSet.loads[0].address || '<unknown>'));

      if (load)
        exc = addToError(exc, 'Error loading "' + load.name + '" at ' + (load.address || '<unknown>'));
    }
    else {
      exc = addToError(exc, 'Error linking "' + linkSet.loads[0].name + '" at ' + (linkSet.loads[0].address || '<unknown>'));
    }


    var loads = linkSet.loads.concat([]);
    for (var i = 0, l = loads.length; i < l; i++) {
      var load = loads[i];

      // store all failed load records
      loader.loaderObj.failed = loader.loaderObj.failed || [];
      if (indexOf.call(loader.loaderObj.failed, load) == -1)
        loader.loaderObj.failed.push(load);

      var linkIndex = indexOf.call(load.linkSets, linkSet);
      console.assert(linkIndex != -1, 'link not present');
      load.linkSets.splice(linkIndex, 1);
      if (load.linkSets.length == 0) {
        var globalLoadsIndex = indexOf.call(linkSet.loader.loads, load);
        if (globalLoadsIndex != -1)
          linkSet.loader.loads.splice(globalLoadsIndex, 1);
      }
    }
    linkSet.reject(exc);
  }

  // 15.2.5.2.5
  function finishLoad(loader, load) {
    // add to global trace if tracing
    if (loader.loaderObj.trace) {
      if (!loader.loaderObj.loads)
        loader.loaderObj.loads = {};
      var depMap = {};
      load.dependencies.forEach(function(dep) {
        depMap[dep.key] = dep.value;
      });
      loader.loaderObj.loads[load.name] = {
        name: load.name,
        deps: load.dependencies.map(function(dep){ return dep.key }),
        depMap: depMap,
        address: load.address,
        metadata: load.metadata,
        source: load.source,
        kind: load.isDeclarative ? 'declarative' : 'dynamic'
      };
    }
    // if not anonymous, add to the module table
    if (load.name) {
      console.assert(!loader.modules[load.name], 'load not in module table');
      loader.modules[load.name] = load.module;
    }
    var loadIndex = indexOf.call(loader.loads, load);
    if (loadIndex != -1)
      loader.loads.splice(loadIndex, 1);
    for (var i = 0, l = load.linkSets.length; i < l; i++) {
      loadIndex = indexOf.call(load.linkSets[i].loads, load);
      if (loadIndex != -1)
        load.linkSets[i].loads.splice(loadIndex, 1);
    }
    load.linkSets.splice(0, load.linkSets.length);
  }

  function doDynamicExecute(linkSet, load, linkError) {
    try {
      var module = load.execute();
    }
    catch(e) {
      linkError(load, e);
      return;
    }
    if (!module || !(module instanceof Module))
      linkError(load, new TypeError('Execution must define a Module instance'));
    else
      return module;
  }

  // 26.3 Loader

  // 26.3.1.1
  // defined at top

  // importPromises adds ability to import a module twice without error - https://bugs.ecmascript.org/show_bug.cgi?id=2601
  function createImportPromise(loader, name, promise) {
    var importPromises = loader._loader.importPromises;
    return importPromises[name] = promise.then(function(m) {
      importPromises[name] = undefined;
      return m;
    }, function(e) {
      importPromises[name] = undefined;
      throw e;
    });
  }

  Loader.prototype = {
    // 26.3.3.1
    constructor: Loader,
    // 26.3.3.2
    define: function(name, source, options) {
      // check if already defined
      if (this._loader.importPromises[name])
        throw new TypeError('Module is already loading.');
      return createImportPromise(this, name, new Promise(asyncStartLoadPartwayThrough({
        step: 'translate',
        loader: this._loader,
        moduleName: name,
        moduleMetadata: options && options.metadata || {},
        moduleSource: source,
        moduleAddress: options && options.address
      })));
    },
    // 26.3.3.3
    'delete': function(name) {
      var loader = this._loader;
      delete loader.importPromises[name];
      delete loader.moduleRecords[name];
      return loader.modules[name] ? delete loader.modules[name] : false;
    },
    // 26.3.3.4 entries not implemented
    // 26.3.3.5
    get: function(key) {
      if (!this._loader.modules[key])
        return;
      doEnsureEvaluated(this._loader.modules[key], [], this);
      return this._loader.modules[key].module;
    },
    // 26.3.3.7
    has: function(name) {
      return !!this._loader.modules[name];
    },
    // 26.3.3.8
    'import': function(name, parentName) {
      // run normalize first
      var loaderObj = this;

      // added, see https://bugs.ecmascript.org/show_bug.cgi?id=2659
      return Promise.resolve(loaderObj.normalize(name, parentName))
      .then(function(name) {
        var loader = loaderObj._loader;

        if (loader.modules[name]) {
          doEnsureEvaluated(loader.modules[name], [], loader._loader);
          return loader.modules[name].module;
        }

        return loader.importPromises[name] || createImportPromise(loaderObj, name,
          loadModule(loader, name, {})
          .then(function(load) {
            delete loader.importPromises[name];
            return evaluateLoadedModule(loader, load);
          }));
      });
    },
    // 26.3.3.9 keys not implemented
    // 26.3.3.10
    load: function(name, options) {
      if (this._loader.modules[name]) {
        doEnsureEvaluated(this._loader.modules[name], [], this._loader);
        return Promise.resolve(this._loader.modules[name].module);
      }
      return this._loader.importPromises[name] || createImportPromise(this, name, loadModule(this._loader, name, {}));
    },
    // 26.3.3.11
    module: function(source, options) {
      var load = createLoad();
      load.address = options && options.address;
      var linkSet = createLinkSet(this._loader, load);
      var sourcePromise = Promise.resolve(source);
      var loader = this._loader;
      var p = linkSet.done.then(function() {
        return evaluateLoadedModule(loader, load);
      });
      proceedToTranslate(loader, load, sourcePromise);
      return p;
    },
    // 26.3.3.12
    newModule: function (obj) {
      if (typeof obj != 'object')
        throw new TypeError('Expected object');

      // we do this to be able to tell if a module is a module privately in ES5
      // by doing m instanceof Module
      var m = new Module();

      for (var key in obj) {
        (function (key) {
          defineProperty(m, key, {
            configurable: false,
            enumerable: true,
            get: function () {
              return obj[key];
            }
          });
        })(key);
      }

      if (Object.preventExtensions)
        Object.preventExtensions(m);

      return m;
    },
    // 26.3.3.14
    set: function(name, module) {
      if (!(module instanceof Module))
        throw new TypeError('Loader.set(' + name + ', module) must be a module');
      this._loader.modules[name] = {
        module: module
      };
    },
    // 26.3.3.15 values not implemented
    // 26.3.3.16 @@iterator not implemented
    // 26.3.3.17 @@toStringTag not implemented

    // 26.3.3.18.1
    normalize: function(name, referrerName, referrerAddress) {
      return name;
    },
    // 26.3.3.18.2
    locate: function(load) {
      return load.name;
    },
    // 26.3.3.18.3
    fetch: function(load) {
    },
    // 26.3.3.18.4
    translate: function(load) {
      return load.source;
    },
    // 26.3.3.18.5
    instantiate: function(load) {
    }
  };

  var _newModule = Loader.prototype.newModule;
/*
 * ES6 Module Declarative Linking Code - Dev Build Only
 */
  function link(linkSet, linkError) {

    var loader = linkSet.loader;

    if (!linkSet.loads.length)
      return;

    var loads = linkSet.loads.concat([]);

    for (var i = 0; i < loads.length; i++) {
      var load = loads[i];

      var module = doDynamicExecute(linkSet, load, linkError);
      if (!module)
        return;
      load.module = {
        name: load.name,
        module: module
      };
      load.status = 'linked';

      finishLoad(loader, load);
    }
  }

  function evaluateLoadedModule(loader, load) {
    console.assert(load.status == 'linked', 'is linked ' + load.name);
    return load.module.module;
  }

  function doEnsureEvaluated() {}
})();/*
*********************************************************************************************

  System Loader Implementation

    - Implemented to https://github.com/jorendorff/js-loaders/blob/master/browser-loader.js

    - <script type="module"> supported

*********************************************************************************************
*/

var System;

function SystemLoader(options) {
  Loader.call(this, options || {});

  var baseURL;
  // Set default baseURL and paths
  if (isWorker) {
    baseURL = __global.location.href;
  }
  else if (typeof document != 'undefined') {
    baseURL = document.baseURI;

    if (!baseURL) {
      var bases = document.getElementsByTagName('base');
      baseURL = bases[0] && bases[0].href || window.location.href;
    }

    // sanitize out the hash and querystring
    baseURL = baseURL.split('#')[0].split('?')[0];
    baseURL = baseURL.substr(0, baseURL.lastIndexOf('/') + 1);
  }
  else if (typeof process != 'undefined' && process.cwd) {
    baseURL = 'file://' + (isWindows ? '/' : '') + process.cwd() + '/';
    if (isWindows)
      baseURL = baseURL.replace(/\\/g, '/');
  }
  else {
    throw new TypeError('No environment baseURL');
  }

  this.baseURL = baseURL;
  this.paths = {};
}

(function() {
  var fetchTextFromURL;
  if (typeof XMLHttpRequest != 'undefined') {
    fetchTextFromURL = function(url, fulfill, reject) {
      var xhr = new XMLHttpRequest();
      var sameDomain = true;
      var doTimeout = false;
      if (!('withCredentials' in xhr)) {
        // check if same domain
        var domainCheck = /^(\w+:)?\/\/([^\/]+)/.exec(url);
        if (domainCheck) {
          sameDomain = domainCheck[2] === window.location.host;
          if (domainCheck[1])
            sameDomain &= domainCheck[1] === window.location.protocol;
        }
      }
      if (!sameDomain && typeof XDomainRequest != 'undefined') {
        xhr = new XDomainRequest();
        xhr.onload = load;
        xhr.onerror = error;
        xhr.ontimeout = error;
        xhr.onprogress = function() {};
        xhr.timeout = 0;
        doTimeout = true;
      }
      function load() {
        fulfill(xhr.responseText);
      }
      function error() {
        reject(xhr.statusText + ': ' + url || 'XHR error');
      }

      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status === 200 || (xhr.status == 0 && xhr.responseText)) {
            load();
          } else {
            error();
          }
        }
      };
      xhr.open("GET", url, true);

      if (doTimeout)
        setTimeout(function() {
          xhr.send();
        }, 0);

      xhr.send(null);
    };
  }
  else if (typeof require != 'undefined') {
    var fs;
    fetchTextFromURL = function(url, fulfill, reject) {
      if (url.substr(0, 8) != 'file:///')
        throw 'Only file URLs of the form file:/// allowed running in Node.';
      fs = fs || require('fs');
      if (isWindows)
        url = url.replace(/\//g, '\\').substr(8);
      else
        url = url.substr(7);
      return fs.readFile(url, function(err, data) {
        if (err)
          return reject(err);
        else
          fulfill(data + '');
      });
    };
  }
  else {
    throw new TypeError('No environment fetch API available.');
  }

  // inline Object.create-style class extension
  function LoaderProto() {}
  LoaderProto.prototype = Loader.prototype;
  SystemLoader.prototype = new LoaderProto();

  SystemLoader.prototype.normalize = function(name, parentName, parentAddress) {
    if (typeof name != 'string')
      throw new TypeError('Module name must be a string');

    var segments = name.split('/');

    // current segment
    var i = 0;
    // is the module name relative
    var rel = false;
    // number of backtracking segments
    var dotdots = 0;
    if (segments[0] == '.') {
      i++;
      rel = true;
    }
    else {
      while (segments[i] == '..') {
        i++;
      }
      if (i)
        rel = true;
      dotdots = i;
    }

    if (!rel)
      return name;

    // build the full module name
    var normalizedParts = [];
    var parentParts = (parentName || '').split('/');
    var normalizedLen = parentParts.length - 1 - dotdots;

    normalizedParts = normalizedParts.concat(parentParts.splice(0, parentParts.length - 1 - dotdots));
    normalizedParts = normalizedParts.concat(segments.splice(i, segments.length - i));

    return normalizedParts.join('/');
  };

  var baseURLCache = {};

  SystemLoader.prototype.locate = function(load) {
    var name = load.name;

    // NB no specification provided for System.paths, used ideas discussed in https://github.com/jorendorff/js-loaders/issues/25

    // most specific (most number of slashes in path) match wins
    var pathMatch = '', wildcard, maxSlashCount = 0;

    // check to see if we have a paths entry
    for (var p in this.paths) {
      var pathParts = p.split('*');
      if (pathParts.length > 2)
        throw new TypeError('Only one wildcard in a path is permitted');

      // exact path match
      if (pathParts.length == 1) {
        if (name == p) {
          pathMatch = p;
          break;
        }
      }
      // wildcard path match
      else {
        var slashCount = p.split('/').length;
        if (slashCount >= maxSlashCount &&
            name.substr(0, pathParts[0].length) == pathParts[0] &&
            name.substr(name.length - pathParts[1].length) == pathParts[1]) {
              maxSlashCount = slashCount;
              pathMatch = p;
              wildcard = name.substr(pathParts[0].length, name.length - pathParts[1].length - pathParts[0].length);
            }
      }
    }

    var outPath = this.paths[pathMatch] || name;
    if (wildcard)
      outPath = outPath.replace('*', wildcard);

    // percent encode just '#' in module names
    // according to https://github.com/jorendorff/js-loaders/blob/master/browser-loader.js#L238
    // we should encode everything, but it breaks for servers that don't expect it
    // like in (https://github.com/systemjs/systemjs/issues/168)
    if (isBrowser)
      outPath = outPath.replace(/#/g, '%23');

    return new URL(outPath, baseURLCache[this.baseURL] = baseURLCache[this.baseURL] || new URL(this.baseURL)).href;
  };

  SystemLoader.prototype.fetch = function(load) {
    return new Promise(function(resolve, reject) {
      fetchTextFromURL(load.address, resolve, reject);
    });
  };

})();
// SystemJS Loader Class and Extension helpers

function SystemJSLoader(options) {
  SystemLoader.call(this, options);

  systemJSConstructor.call(this, options);
}

// inline Object.create-style class extension
function SystemProto() {};
SystemProto.prototype = SystemLoader.prototype;
SystemJSLoader.prototype = new SystemProto();

var systemJSConstructor;

function hook(name, hook) {
  SystemJSLoader.prototype[name] = hook(SystemJSLoader.prototype[name]);
}
function hookConstructor(hook) {
  systemJSConstructor = hook(systemJSConstructor || function() {});
}

function dedupe(deps) {
  var newDeps = [];
  for (var i = 0, l = deps.length; i < l; i++)
    if (indexOf.call(newDeps, deps[i]) == -1)
      newDeps.push(deps[i])
  return newDeps;
}

// if a module only has a default export, then take that as the module value
function checkGetDefault(module) {
  if (module && module.__useDefault)
    return module['default'];
  for (var p in module) {
    if (p != 'default')
      return module;
  }
  return 'default' in module ? module['default'] : module;
}

/*
  __useDefault
  
  When a module object looks like:
  newModule(
    __useDefault: true,
    default: 'some-module'
  })

  Then importing that module provides the 'some-module'
  result directly instead of the full module.

  Useful for eg module.exports = function() {}
*/
hook('import', function(systemImport) {
  return function(name, parentName) {
    return systemImport.call(this, name, parentName).then(function(module) {
      return module.__useDefault ? module['default'] : module;
    });
  };
});  /*
   * Config
   */
(function() {
  /*
   Extend config merging one deep only

    loader.config({
      some: 'random',
      config: 'here',
      deep: {
        config: { too: 'too' }
      }
    });

    <=>

    loader.some = 'random';
    loader.config = 'here'
    loader.deep = loader.deep || {};
    loader.deep.config = { too: 'too' };
  */
  SystemLoader.prototype.config = function(cfg) {
    for (var c in cfg) {
      var v = cfg[c];
      if (typeof v == 'object' && !(v instanceof Array)) {
        this[c] = this[c] || {};
        for (var p in v)
          this[c][p] = v[p];
      }
      else
        this[c] = v;
    }
  };

  var baseURL;
  hookConstructor(function(constructor) {
    return function() {
      var loader = this;
      constructor.call(loader);
      baseURL = loader.baseURL;

      // support the empty module, as a concept
      loader.set('@empty', loader.newModule({}));
    };
  });

  // allow baseURL to be a relative URL
  var normalizedBaseURL;
  hook('locate', function(locate) {
    return function(load) {
      if (this.baseURL != normalizedBaseURL) {
        normalizedBaseURL = new URL(this.baseURL, baseURL).href;

        if (normalizedBaseURL.substr(normalizedBaseURL.length - 1, 1) != '/')
          normalizedBaseURL += '/';
        this.baseURL = normalizedBaseURL;
      }

      return Promise.resolve(locate.call(this, load));
    };
  });
})();/*
 * Script tag fetch
 *
 * When load.metadata.scriptLoad is true, we load via script tag injection.
 */
(function() {

  if (typeof document != 'undefined')
    var head = document.getElementsByTagName('head')[0];

  // call this functione everytime a wrapper executes
  SystemJSLoader.prototype.onScriptLoad = function() {};

  function webWorkerImport(load) {
    return new Promise(function(resolve, reject) {
      try {
        importScripts(load.address);
      }
      catch(e) {
        reject(e);
      }

      this.onScriptLoad(load);
      // if nothing registered, then something went wrong
      if (!load.metadata.registered)
        reject(load.address + ' did not call System.register or AMD define');

      resolve('');
    });
  }

  // override fetch to use script injection
  hook('fetch', function(fetch) {
    return function(load) {
      var loader = this;

      if (!load.metadata.scriptLoad || !isBrowser)
        return fetch.call(this, load);

      if (isWorker)
        return webWorkerImport.call(this, load);

      return new Promise(function(resolve, reject) {
        var s = document.createElement('script');
        s.async = true;

        function complete(evt) {
          if (s.readyState && s.readyState != 'loaded' && s.readyState != 'complete')
            return;
          cleanup();

          // this runs synchronously after execution
          // we now need to tell the wrapper handlers that
          // this load record has just executed
          loader.onScriptLoad(load);

          // if nothing registered, then something went wrong
          if (!load.metadata.registered)
            reject(load.address + ' did not call System.register or AMD define');

          resolve('');
        }

        function error(evt) {
          cleanup();
          reject(new Error('Unable to load script ' + load.address));
        }

        if (s.attachEvent) {
          s.attachEvent('onreadystatechange', complete);
        }
        else {
          s.addEventListener('load', complete, false);
          s.addEventListener('error', error, false);
        }

        s.src = load.address;
        head.appendChild(s);

        function cleanup() {
          if (s.detachEvent)
            s.detachEvent('onreadystatechange', complete);
          else {
            s.removeEventListener('load', complete, false);
            s.removeEventListener('error', error, false);
          }
          head.removeChild(s);
        }
      });
    };
  });
})();
/*
 * Meta Extension
 *
 * Sets default metadata on a load record (load.metadata) from
 * loader.meta.
 *
 *
 * Also provides an inline meta syntax for module meta in source.
 *
 * Eg:
 *
 * loader.meta['my/module'] = { deps: ['jquery'] };
 * loader.meta['my/*'] = { format: 'amd' };
 *
 * load.metadata.deps and load.metadata.format will then be set
 * for 'my/module'
 *
 * The same meta could be set with a my/module.js file containing:
 * 
 * my/module.js
 *   "format amd"; 
 *   "deps jquery";
 *   "globals.some value"
 *   console.log('this is my/module');
 *
 * Configuration meta always takes preference to inline meta.
 *
 * Multiple matches in wildcards are supported and ammend the meta.
 * 
 */

(function() {

  hookConstructor(function(constructor) {
    return function() {
      constructor.call(this);
      this.meta = {};
    };
  });

  function extend(a, b, overwrite) {
    for (var p in b) {
      if (overwrite || !(p in a))
        a[p] = b[p];
    }
  }

  hook('locate', function(locate) {
    return function(load) {
      var meta = this.meta;
      var name = load.name;

      // NB for perf, maybe introduce a fast-path wildcard lookup cache here
      // which is checked first

      // apply wildcard metas
      var bestDepth = 0;
      var wildcardIndex;
      for (var module in meta) {
        wildcardIndex = indexOf.call(module, '*');
        if (wildcardIndex === -1)
          continue;
        if (module.substr(0, wildcardIndex) === name.substr(0, wildcardIndex)
            && module.substr(wildcardIndex + 1) === name.substr(name.length - module.length + wildcardIndex + 1)) {
          var depth = module.split('/').length;
          if (depth > bestDepth)
            bestDetph = depth;
          extend(load.metadata, meta[module], bestDepth == depth);
        }
      }

      // apply exact meta
      if (meta[name])
        extend(load.metadata, meta[name], true);

      return locate.call(this, load);
    };
  });

  // detect any meta header syntax
  // only set if not already set
  var metaRegEx = /^(\s*\/\*.*\*\/|\s*\/\/[^\n]*|\s*"[^"]+"\s*;?|\s*'[^']+'\s*;?)+/;
  var metaPartRegEx = /\/\*.*\*\/|\/\/[^\n]*|"[^"]+"\s*;?|'[^']+'\s*;?/g;

  function setMetaProperty(target, p, value) {
    var pParts = p.split('.');
    var curPart;
    while (pParts.length > 1) {
      curPart = pParts.shift();
      target = target[curPart] = target[curPart] || {};
    }
    curPart = pParts.shift();
    if (!(curPart in target))
      target[curPart] = value;
  }

  hook('translate', function(translate) {
    return function(load) {
      var meta = load.source.match(metaRegEx);
      if (meta) {
        var metaParts = meta[0].match(metaPartRegEx);

        for (var i = 0; i < metaParts.length; i++) {
          var curPart = metaParts[i];
          var len = curPart.length;

          var firstChar = curPart.substr(0, 1);
          if (curPart.substr(len - 1, 1) == ';')
            len--;
        
          if (firstChar != '"' && firstChar != "'")
            continue;

          var metaString = curPart.substr(1, curPart.length - 3);
          var metaName = metaString.substr(0, metaString.indexOf(' '));

          if (metaName) {
            var metaValue = metaString.substr(metaName.length + 1, metaString.length - metaName.length - 1);

            setMetaProperty(load.metadata, metaName, metaValue);
          }
        }
      }
      
      return translate.call(this, load);
    };
  });
})();/*
 * Script-only addition used for production loader
 *
 */

hook('fetch', function(fetch) {
  return function(load) {
    load.metadata.scriptLoad = true;
    return fetch.call(this, load);
  };
});/*
 * Instantiate registry extension
 *
 * Supports Traceur System.register 'instantiate' output for loading ES6 as ES5.
 *
 * - Creates the loader.register function
 * - Also supports metadata.format = 'system' in instantiate for anonymous register modules
 * - Also supports metadata.deps, metadata.execute and metadata.executingRequire
 *     for handling dynamic modules alongside register-transformed ES6 modules
 *
 *
 * The code here replicates the ES6 linking groups algorithm to ensure that
 * circular ES6 compiled into System.register can work alongside circular AMD 
 * and CommonJS, identically to the actual ES6 loader.
 *
 */
(function() {

  /*
   * There are two variations of System.register:
   * 1. System.register for ES6 conversion (2-3 params) - System.register([name, ]deps, declare)
   *    see https://github.com/ModuleLoader/es6-module-loader/wiki/System.register-Explained
   *
   * 2. System.registerDynamic for dynamic modules (3-4 params) - System.registerDynamic([name, ]deps, executingRequire, execute)
   * the true or false statement 
   *
   * this extension implements the linking algorithm for the two variations identical to the spec
   * allowing compiled ES6 circular references to work alongside AMD and CJS circular references.
   *
   */
  var anonRegister;
  var calledRegister;
  function doRegister(loader, name, register) {
    calledRegister = true;

    // named register
    if (name) {
      register.name = name;
      // we never overwrite an existing define
      if (!(name in loader.defined))
        loader.defined[name] = register; 
    }
    // anonymous register
    else if (register.declarative) {
      if (anonRegister)
        throw new TypeError('Multiple anonymous System.register calls in the same module file.');
      anonRegister = register;
    }
  }
  SystemJSLoader.prototype.register = function(name, deps, declare) {
    if (typeof name != 'string') {
      declare = deps;
      deps = name;
      name = null;
    }

    // dynamic backwards-compatibility
    // can be deprecated eventually
    if (typeof declare == 'boolean')
      throw new TypeError('System.register has been split into System.register and System.registerDyanmic taking three arguments and four argument forms respectively. The bundle may need to be rebuilt.');

    doRegister(this, name, {
      declarative: true,
      deps: deps,
      declare: declare
    });
  };
  SystemJSLoader.prototype.registerDynamic = function(name, deps, declare, execute) {
    if (typeof name != 'string') {
      execute = declare;
      declare = deps;
      deps = name;
      name = null;
    }

    // dynamic
    doRegister(this, name, {
      declarative: false,
      deps: deps,
      execute: execute,
      executingRequire: declare
    });
  };
  /*
   * Registry side table - loader.defined
   * Registry Entry Contains:
   *    - name
   *    - deps 
   *    - declare for declarative modules
   *    - execute for dynamic modules, different to declarative execute on module
   *    - executingRequire indicates require drives execution for circularity of dynamic modules
   *    - declarative optional boolean indicating which of the above
   *
   * Can preload modules directly on System.defined['my/module'] = { deps, execute, executingRequire }
   *
   * Then the entry gets populated with derived information during processing:
   *    - normalizedDeps derived from deps, created in instantiate
   *    - groupIndex used by group linking algorithm
   *    - evaluated indicating whether evaluation has happend
   *    - module the module record object, containing:
   *      - exports actual module exports
   *
   *    For dynamic we track the es module with:
   *    - esModule actual es module value
   *      
   *    Then for declarative only we track dynamic bindings with the 'module' records:
   *      - name
   *      - exports
   *      - setters declarative setter functions
   *      - dependencies, module records of dependencies
   *      - importers, module records of dependents
   *
   * After linked and evaluated, entries are removed, declarative module records remain in separate
   * module binding table
   *
   */
  hookConstructor(function(constructor) {
    return function() {
      constructor.call(this);

      this.defined = {};
    };
  });

  // script injection mode calls this function synchronously on load
  hook('onScriptLoad', function(onScriptLoad) {
    return function(load) {
      onScriptLoad.call(this, load);

      // anonymous define
      if (anonRegister)
        load.metadata.entry = anonRegister;
      
      if (calledRegister) {
        load.metadata.format = load.metadata.format || 'system';
        load.metadata.registered = true;
      }
    };
  });

  function buildGroups(entry, loader, groups) {
    groups[entry.groupIndex] = groups[entry.groupIndex] || [];

    if (indexOf.call(groups[entry.groupIndex], entry) != -1)
      return;

    groups[entry.groupIndex].push(entry);

    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      var depEntry = loader.defined[depName];
      
      // not in the registry means already linked / ES6
      if (!depEntry || depEntry.evaluated)
        continue;
      
      // now we know the entry is in our unlinked linkage group
      var depGroupIndex = entry.groupIndex + (depEntry.declarative != entry.declarative);

      // the group index of an entry is always the maximum
      if (depEntry.groupIndex === undefined || depEntry.groupIndex < depGroupIndex) {
        
        // if already in a group, remove from the old group
        if (depEntry.groupIndex !== undefined) {
          groups[depEntry.groupIndex].splice(indexOf.call(groups[depEntry.groupIndex], depEntry), 1);

          // if the old group is empty, then we have a mixed depndency cycle
          if (groups[depEntry.groupIndex].length == 0)
            throw new TypeError("Mixed dependency cycle detected");
        }

        depEntry.groupIndex = depGroupIndex;
      }

      buildGroups(depEntry, loader, groups);
    }
  }

  function link(name, loader) {
    var startEntry = loader.defined[name];

    // skip if already linked
    if (startEntry.module)
      return;

    startEntry.groupIndex = 0;

    var groups = [];

    buildGroups(startEntry, loader, groups);

    var curGroupDeclarative = !!startEntry.declarative == groups.length % 2;
    for (var i = groups.length - 1; i >= 0; i--) {
      var group = groups[i];
      for (var j = 0; j < group.length; j++) {
        var entry = group[j];

        // link each group
        if (curGroupDeclarative)
          linkDeclarativeModule(entry, loader);
        else
          linkDynamicModule(entry, loader);
      }
      curGroupDeclarative = !curGroupDeclarative; 
    }
  }

  // module binding records
  var moduleRecords = {};
  function getOrCreateModuleRecord(name) {
    return moduleRecords[name] || (moduleRecords[name] = {
      name: name,
      dependencies: [],
      exports: {}, // start from an empty module and extend
      importers: []
    })
  }

  function linkDeclarativeModule(entry, loader) {
    // only link if already not already started linking (stops at circular)
    if (entry.module)
      return;

    var module = entry.module = getOrCreateModuleRecord(entry.name);
    var exports = entry.module.exports;

    var declaration = entry.declare.call(__global, function(name, value) {
      module.locked = true;
      exports[name] = value;

      for (var i = 0, l = module.importers.length; i < l; i++) {
        var importerModule = module.importers[i];
        if (!importerModule.locked) {
          var importerIndex = indexOf.call(importerModule.dependencies, module);
          importerModule.setters[importerIndex](exports);
        }
      }

      module.locked = false;
      return value;
    });
    
    module.setters = declaration.setters;
    module.execute = declaration.execute;

    if (!module.setters || !module.execute) {
      throw new TypeError('Invalid System.register form for ' + entry.name);
    }

    // now link all the module dependencies
    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      var depEntry = loader.defined[depName];
      var depModule = moduleRecords[depName];

      // work out how to set depExports based on scenarios...
      var depExports;

      if (depModule) {
        depExports = depModule.exports;
      }
      // dynamic, already linked in our registry
      else if (depEntry && !depEntry.declarative) {
        depExports = depEntry.esModule;
      }
      // in the loader registry
      else if (!depEntry) {
        depExports = loader.get(depName);
      }
      // we have an entry -> link
      else {
        linkDeclarativeModule(depEntry, loader);
        depModule = depEntry.module;
        depExports = depModule.exports;
      }

      // only declarative modules have dynamic bindings
      if (depModule && depModule.importers) {
        depModule.importers.push(module);
        module.dependencies.push(depModule);
      }
      else {
        module.dependencies.push(null);
      }

      // run the setter for this dependency
      if (module.setters[i])
        module.setters[i](depExports);
    }
  }

  // An analog to loader.get covering execution of all three layers (real declarative, simulated declarative, simulated dynamic)
  function getModule(name, loader) {
    var exports;
    var entry = loader.defined[name];

    if (!entry) {
      exports = loader.get(name);
      if (!exports)
        throw new Error('Unable to load dependency ' + name + '.');
    }

    else {
      if (entry.declarative)
        ensureEvaluated(name, [], loader);
    
      else if (!entry.evaluated)
        linkDynamicModule(entry, loader);

      exports = entry.module.exports;
    }

    if ((!entry || entry.declarative))
      return checkGetDefault(exports);
    
    return exports;
  }

  function linkDynamicModule(entry, loader) {
    if (entry.module)
      return;

    var exports = {};

    var module = entry.module = { exports: exports, id: entry.name, deps: entry.normalizedDeps };

    // AMD requires execute the tree first
    if (!entry.executingRequire) {
      for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
        var depName = entry.normalizedDeps[i];
        var depEntry = loader.defined[depName];
        if (depEntry)
          linkDynamicModule(depEntry, loader);
      }
    }

    // now execute
    entry.evaluated = true;
    var output = entry.execute.call(__global, function(name) {
      for (var i = 0, l = entry.deps.length; i < l; i++) {
        if (entry.deps[i] != name)
          continue;
        return getModule(entry.normalizedDeps[i], loader);
      }
      throw new TypeError('Module ' + name + ' not declared as a dependency.');
    }, exports, module);
    
    if (output)
      module.exports = output;

    // create the esModule object, which allows ES6 named imports of dynamics
    exports = module.exports;

    if (exports && exports.__esModule) {
      entry.esModule = exports;
    }
    else {
      var hasOwnProperty = exports && exports.hasOwnProperty;
      entry.esModule = {};
      if (typeof exports == 'object' || typeof exports == 'function')
        for (var p in exports) {
          if (!hasOwnProperty || exports.hasOwnProperty(p))
            entry.esModule[p] = exports[p];
        }
      entry.esModule['default'] = exports;
      entry.esModule.__useDefault = true;
    }
  }

  /*
   * Given a module, and the list of modules for this current branch,
   *  ensure that each of the dependencies of this module is evaluated
   *  (unless one is a circular dependency already in the list of seen
   *  modules, in which case we execute it)
   *
   * Then we evaluate the module itself depth-first left to right 
   * execution to match ES6 modules
   */
  function ensureEvaluated(moduleName, seen, loader) {
    var entry = loader.defined[moduleName];

    // if already seen, that means it's an already-evaluated non circular dependency
    if (!entry || entry.evaluated || !entry.declarative)
      return;

    // this only applies to declarative modules which late-execute

    seen.push(moduleName);

    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      if (indexOf.call(seen, depName) == -1) {
        if (!loader.defined[depName])
          loader.get(depName);
        else
          ensureEvaluated(depName, seen, loader);
      }
    }

    if (entry.evaluated)
      return;

    entry.evaluated = true;
    entry.module.execute.call(__global);
  }

  var registerRegEx = /System\.register(Dynamic)?\s*\(/;

  hook('fetch', function(fetch) {
    return function(load) {
      if (this.defined[load.name]) {
        load.metadata.format = 'defined';
        return '';
      }
      
      // this is the synchronous chain for onScriptLoad
      anonRegister = null;
      calledRegister = false;
      
      if (load.metadata.format == 'system')
        load.metadata.scriptLoad = true;
      
      return fetch.call(this, load);
    };
  });

  hook('translate', function(translate) {
    // we run the meta detection here (register is after meta)
    return function(load) {
      return Promise.resolve(translate.call(this, load)).then(function(source) {

        if (typeof load.metadata.deps === 'string')
          load.metadata.deps = load.metadata.deps.split(',');
        load.metadata.deps = load.metadata.deps || [];

        // run detection for register format
        if (load.metadata.format == 'system' || !load.metadata.format && load.source.match(registerRegEx))
          load.metadata.format = 'system';
        return source;
      });
    };
  });

  hook('instantiate', function(instantiate) {
    return function(load) {
      var loader = this;

      var entry;

      if (load.metadata.format == 'register')
        throw new TypeError(load.name + ' defined as format "register", which has been renamed to "system".');

      // first we check if this module has already been defined in the registry
      if (loader.defined[load.name]) {
        entry = loader.defined[load.name];
        entry.deps = entry.deps.concat(load.metadata.deps);
      }

      // picked up already by a script injection
      else if (load.metadata.entry)
        entry = load.metadata.entry;

      // otherwise check if it is dynamic
      else if (load.metadata.execute) {
        entry = {
          declarative: false,
          deps: load.metadata.deps || [],
          execute: load.metadata.execute,
          executingRequire: load.metadata.executingRequire // NodeJS-style requires or not
        };
      }

      // Contains System.register calls
      else if (load.metadata.format == 'system' || load.metadata.format == 'es') {
        anonRegister = null;
        calledRegister = false;

        var curSystem = __global.System;

        __global.System = loader;

        __exec(load);

        __global.System = curSystem;

        if (anonRegister)
          entry = anonRegister;

        if (!entry && System.defined[load.name])
          entry = System.defined[load.name];

        if (!calledRegister && !load.metadata.registered)
          throw new TypeError(load.name + ' detected as System.register but didn\'t execute.');
      }

      // named bundles are just an empty module
      if (!entry)
        return {
          deps: load.metadata.deps,
          execute: function() {
            return loader.newModule({});
          }
        };

      // place this module onto defined for circular references
      if (entry)
        loader.defined[load.name] = entry;

      // no entry -> treat as ES6
      else
        return instantiate.call(loader, load);

      entry.deps = dedupe(entry.deps);
      entry.name = load.name;

      // first, normalize all dependencies
      var normalizePromises = [];
      for (var i = 0, l = entry.deps.length; i < l; i++)
        normalizePromises.push(Promise.resolve(loader.normalize(entry.deps[i], load.name)));

      return Promise.all(normalizePromises).then(function(normalizedDeps) {

        entry.normalizedDeps = normalizedDeps;

        return {
          deps: entry.deps,
          execute: function() {
            // recursively ensure that the module and all its 
            // dependencies are linked (with dependency group handling)
            link(load.name, loader);

            // now handle dependency execution in correct order
            ensureEvaluated(load.name, [], loader);

            // remove from the registry
            loader.defined[load.name] = undefined;

            // return the defined module object
            return loader.newModule(entry.declarative ? entry.module.exports : entry.esModule);
          }
        };
      });
    };
  });
})();
hookConstructor(function(constructor) {
  return function() {
    var loader = this;
    constructor.call(loader);

    var hasOwnProperty = __global.hasOwnProperty;

    var curGlobalObj;
    var ignoredGlobalProps = ['_g', 'indexedDB', 'sessionStorage', 'localStorage',
        'clipboardData', 'frames', 'webkitStorageInfo', 'toolbar', 'statusbar',
        'scrollbars', 'personalbar', 'menubar', 'locationbar', 'webkitIndexedDB',
        'screenTop', 'screenLeft'];

    loader.set('@@global-helpers', loader.newModule({
      prepareGlobal: function(moduleName) {
        // store a complete copy of the global object in order to detect changes
        curGlobalObj = {};

        for (var g in __global) {
          if (indexOf.call(ignoredGlobalProps, g) != -1)
            continue;
          if (!hasOwnProperty || __global.hasOwnProperty(g)) {
            try {
              curGlobalObj[g] = __global[g];
            }
            catch (e) {
              ignoredGlobalProps.push(g);
            }
          }
        }
      },
      retrieveGlobal: function(moduleName) {
        var singleGlobal;
        var multipleExports;
        var exports;

        for (var g in __global) {
          if (indexOf.call(ignoredGlobalProps, g) != -1)
            continue;

          var value = __global[g];

          // see which globals differ from the previous copy to determine global exports
          if ((!hasOwnProperty || __global.hasOwnProperty(g)) 
              && g !== __global && curGlobalObj[g] !== value) {
            if (!exports) {
              // first property found
              exports = {};
              singleGlobal = value;
            }
            
            exports[g] = value;
            
            if (!multipleExports && singleGlobal !== value)
              multipleExports = true;
          }
        }

        return multipleExports ? exports : singleGlobal;
      }
    }));
  };
});/*
  SystemJS map support
  
  Provides map configuration through
    System.map['jquery'] = 'some/module/map'

  Note that this applies for subpaths, just like RequireJS:

  jquery      -> 'some/module/map'
  jquery/path -> 'some/module/map/path'
  bootstrap   -> 'bootstrap'

  The most specific map is always taken, as longest path length
*/
hookConstructor(function(constructor) {
  return function() {
    constructor.call(this);
    this.map = {};
  };
});

hook('normalize', function(normalize) {
  return function(name, parentName, parentAddress) {
    var loader = this;
    return Promise.resolve(normalize.call(loader, name, parentName, parentAddress))
    .then(function(name) {
      var bestMatch, bestMatchLength = 0;

      // now do the global map
      for (var p in loader.map) {
        if (typeof loader.map[p] != 'string')
          throw new TypeError('Map configuration no longer permits object submaps. Use package map instead (`System.packages[name].map`).');

        if (name.substr(0, p.length) == p && (name.length == p.length || name[p.length] == '/')) {
          var curMatchLength = p.split('/').length;
          if (curMatchLength <= bestMatchLength)
            continue;
          bestMatch = p;
          bestMatchLength = curMatchLength;
        }
      }

      if (bestMatch)
        return loader.map[bestMatch] + name.substr(bestMatch.length);

      return name;
    });
  };
});
/*
 * Package Configuration Extension
 *
 * Creates new `System.packages` configuration function.
 * Which in turn populates base-level configs.
 * Also adds support for package mains.
 *
 * Example:
 *
 * System.config({
 *   packages: {
 *     jquery: {
 *       main: 'index.js', // this main is actually set by default
 *       format: 'amd',
 *       defaultExtension: 'js',
 *       meta: {
 *         '*.ts': {
 *           plugin: 'typescript'
 *         },
 *         'vendor/sizzle.js': {
 *           format: 'global'
 *         }
 *       },
 *       map: {
 *         // map internal require('sizzle') to local require('./vendor/sizzle')
 *         sizzle: './vendor/sizzle.js',
 *
 *         // map any internal or external require of 'jquery/vendor/another' to 'another/index.js'
 *         './vendor/another': 'another/index.js'
 *       }
 *     }
 *   }
 * });
 *
 * Then:
 *   import 'jquery'                -> jquery/index.js
 *   import 'jquery/submodule'      -> jquery/submodule.js
 *   import 'jquery/vendor/another' -> jquery/another/index.js
 *
 * In addition, the following meta properties will be allowed to be package
 * -relative as well in the package meta config:
 *   
 *   - plugin
 *   - alias
 *
 */
(function() {

  hookConstructor(function(constructor) {
    return function() {
      constructor.call(this);
      this.packages = {};
    };
  });

  function getPackage(name) {
    for (var p in this.packages) {
      if (name.substr(0, p.length) === p && (name.length === p.length || name[p.length] === '/'))
        return p;
    }
  }

  function applyMap(map, name) {
    var bestMatch, bestMatchLength = 0;
    
    for (var p in map) {
      if (name.substr(0, p.length) == p && (name.length == p.length || name[p.length] == '/')) {
        var curMatchLength = p.split('/').length;
        if (curMatchLength <= bestMatchLength)
          continue;
        bestMatch = p;
        bestMatchLength = curMatchLength;
      }
    }
    if (bestMatch)
      name = map[bestMatch] + name.substr(bestMatch.length);

    return name;
  }

  hook('normalize', function(normalize) {
    return function(name, parentName, parentAddress) {
      var loader = this;

      // apply contextual package map first
      if (parentName)
        var parentPackage = getPackage.call(loader, parentName);

      if (parentPackage && name[0] !== '.') {
        var parentMap = loader.packages[parentPackage].map;
        if (parentMap) {
          name = applyMap(parentMap, name);

          // relative maps are package-relative
          if (name[0] === '.')
            parentName = parentPackage;
        }
      }

      // apply global map, relative normalization
      return normalize.call(loader, name, parentName, parentAddress)
      .then(function(normalized) {
        // check if we are inside a package
        var pkgName = getPackage.call(loader, normalized);

        if (pkgName) {
          var pkg = loader.packages[pkgName];

          // main
          if (pkgName === normalized)
            normalized += '/' + (pkg.main || 'index.js');

          // relative maps
          if (pkg.map) {
            normalized = pkgName + applyMap(pkg.map, '.' + normalized.substr(pkgName.length)).substr(1);

            // normalize package-relative maps
            if (normalized.substr(0, 2) == './')
              normalized = pkgName + normalized.substr(1);
          }

          // defaultExtension
          if (pkg.defaultExtension 
              && (!pkg.meta || !pkg.meta[normalized.substr(pkgName.length + 1)])
              && normalized.split('/').pop().indexOf('.') == -1)
            normalized += '.' + pkg.defaultExtension;
        }

        return normalized;
      });
    };
  });

  function extend(a, b, overwrite) {
    for (var p in b) {
      if (overwrite || !(p in a))
        a[p] = b[p];
    }
  }

  hook('locate', function(locate) {
    return function(load) {
      var loader = this;
      return Promise.resolve(locate.call(this, load))
      .then(function(address) {
        var pkgName = getPackage.call(loader, load.name);
        if (pkgName) {
          var pkg = loader.packages[pkgName];
          
          // format
          if (pkg.format)
            load.metadata.format = load.metadata.format || pkg.format;

          if (pkg.meta) {
            // wildcard meta
            var meta = {};
            var bestDepth = 0;
            var wildcardIndex;
            for (var module in pkg.meta) {
              wildcardIndex = indexOf.call(module, '*');
              if (wildcardIndex === -1)
                continue;
              if (module.substr(0, wildcardIndex) === load.name.substr(0, wildcardIndex)
                  && module.substr(wildcardIndex + 1) === load.name.substr(load.name.length - module.length + wildcardIndex + 1)) {
                var depth = module.split('/').length;
                if (depth > bestDepth)
                  bestDetph = depth;
                extend(meta, pkg.meta[module], bestDepth == depth);
              }
            }
            // exact meta
            if (pkg.meta[load.name])
              extend(meta, meta[load.name], true);
            
            extend(load.metadata, meta);
          }
        }

        return address;
      });
    };
  });

})();/*
  SystemJS Plugin Support

  Supports plugin syntax with "!", or via metadata.plugin

  The plugin name is loaded as a module itself, and can override standard loader hooks
  for the plugin resource. See the plugin section of the systemjs readme.
*/
(function() {
  hook('normalize', function(normalize) {
    // plugin syntax normalization
    return function(name, parentName, parentAddress) {
      var loader = this;
      // if parent is a plugin, normalize against the parent plugin argument only
      var parentPluginIndex;
      if (parentName && (parentPluginIndex = parentName.indexOf('!')) != -1)
        parentName = parentName.substr(0, parentPluginIndex);

      return Promise.resolve(normalize.call(loader, name, parentName, parentAddress))
      .then(function(name) {
        // if this is a plugin, normalize the plugin name and the argument
        var pluginIndex = name.lastIndexOf('!');
        if (pluginIndex != -1) {
          var argumentName = name.substr(0, pluginIndex);

          // plugin name is part after "!" or the extension itself
          var pluginName = name.substr(pluginIndex + 1) || argumentName.substr(argumentName.lastIndexOf('.') + 1);

          // normalize the plugin name relative to the same parent
          return new Promise(function(resolve) {
            resolve(loader.normalize(pluginName, parentName, parentAddress)); 
          })
          // normalize the plugin argument
          .then(function(_pluginName) {
            pluginName = _pluginName;
            return loader.normalize(argumentName, parentName, parentAddress);
          })
          .then(function(argumentName) {
            return argumentName + '!' + pluginName;
          });
        }

        // standard normalization
        return name;
      });
    };
  });

  hook('locate', function(locate) {
    return function(load) {
      var loader = this;

      var name = load.name;

      // only fetch the plugin itself if this name isn't defined
      if (loader.defined && loader.defined[name])
        return locate.call(loader, load);

      var pluginSyntaxIndex = name.lastIndexOf('!');
      var plugin = load.metadata.plugin;

      // plugin syntax
      if (pluginSyntaxIndex != -1) {
        plugin = name.substr(pluginSyntaxIndex + 1);
        name = name.substr(0, pluginSyntaxIndex);
      }

      if (plugin) {
        var pluginLoader = loader.pluginLoader || loader;

        // load the plugin module
        return pluginLoader.load(plugin)
        .then(function() {
          var pluginModule = pluginLoader.get(plugin);

          // store the plugin module itself on the metadata
          load.metadata.pluginModule = pluginModule;
          load.metadata.pluginArgument = name;
          load.metadata.plugin = plugin;

          // run plugin locate if given, with name with syntax removed
          var argLoad = {
            name: name,
            address: load.address,
            metadata: {}
          };
          for (var p in load.metadata) {
            if (p !== 'plugin')
            argLoad.metadata[p] = load.metadata[p];
          }
          if (pluginModule.locate)
            return pluginModule.locate.call(loader, argLoad);
          else
            return loader.locate(argLoad);
        });
      }

      return locate.call(loader, load);
    };
  });

  hook('fetch', function(fetch) {
    return function(load) {
      var loader = this;
      if (load.metadata.pluginModule && load.metadata.pluginModule.fetch) {
        load.metadata.scriptLoad = false;
        return load.metadata.pluginModule.fetch.call(loader, load, fetch);
      }
      else {
        return fetch.call(loader, load);
      }
    };
  });

  hook('translate', function(translate) {
    return function(load) {
      var loader = this;
      if (load.metadata.pluginModule && load.metadata.pluginModule.translate)
        return Promise.resolve(load.metadata.pluginModule.translate.call(loader, load)).then(function(result) {
          if (typeof result == 'string')
            load.source = result;
          return translate.call(loader, load);
        });
      else
        return translate.call(loader, load);
    };
  });

  hook('instantiate', function(instantiate) {
    return function(load) {
      var loader = this;
      if (load.metadata.pluginModule && load.metadata.pluginModule.instantiate)
        return Promise.resolve(load.metadata.pluginModule.instantiate.call(loader, load)).then(function(result) {
          load.metadata.format = 'defined';
          load.metadata.execute = function() {
            return result;
          };
          return instantiate.call(loader, load);
        });
      else
        return instantiate.call(loader, load);
    };
  });

})();
/*
 * Alias Extension
 *
 * Allows a module to be a plain copy of another module by module name
 *
 * System.meta['mybootstrapalias'] = { alias: { 'bootstrap' } };
 *
 */
(function() {
  // aliases
  hook('fetch', function(fetch) {
    return function(load) {
      var alias = load.metadata.alias;
      if (alias) {
        load.metadata.format = 'defined';
        this.defined[load.name] = {
          declarative: true,
          deps: [alias],
          declare: function(_export) {
            return {
              setters: [function(module) {
                for (var p in module)
                  _export(p, module[p]);
              }],
              execute: function() {}
            };
          }
        };
        return '';
      }

      return fetch.call(this, load);
    };
  });
})();/*
  System bundles

  Allows a bundle module to be specified which will be dynamically 
  loaded before trying to load a given module.

  For example:
  System.bundles['mybundle'] = ['jquery', 'bootstrap/js/bootstrap']

  Will result in a load to "mybundle" whenever a load to "jquery"
  or "bootstrap/js/bootstrap" is made.

  In this way, the bundle becomes the request that provides the module
*/

(function() {
  // bundles support (just like RequireJS)
  // bundle name is module name of bundle itself
  // bundle is array of modules defined by the bundle
  // when a module in the bundle is requested, the bundle is loaded instead
  // of the form System.bundles['mybundle'] = ['jquery', 'bootstrap/js/bootstrap']
  hookConstructor(function(constructor) {
    return function() {
      constructor.call(this);
      this.bundles = {};
    };
  });

  hook('fetch', function(fetch) {
    return function(load) {
      var loader = this;
      if (loader.trace)
        return fetch.call(loader, load);

      // if this module is in a bundle, load the bundle first then
      for (var b in loader.bundles) {
        if (indexOf.call(loader.bundles[b], load.name) == -1)
          continue;
        // we do manual normalization in case the bundle is mapped
        // this is so we can still know the normalized name is a bundle
        return Promise.resolve(loader.normalize(b))
        .then(function(normalized) {
          loader.bundles[normalized] = loader.bundles[normalized] || loader.bundles[b];

          // note this module is a bundle in the meta
          loader.meta = loader.meta || {};
          loader.meta[normalized] = loader.meta[normalized] || {};
          loader.meta[normalized].bundle = true;

          return loader.load(normalized);
        })
        .then(function() {
          return '';
        });
      }
      return fetch.call(loader, load);
    };
  });
})();
/*
 * Dependency Tree Cache
 * 
 * Allows a build to pre-populate a dependency trace tree on the loader of 
 * the expected dependency tree, to be loaded upfront when requesting the
 * module, avoinding the n round trips latency of module loading, where 
 * n is the dependency tree depth.
 *
 * eg:
 * System.depCache = {
 *  'app': ['normalized', 'deps'],
 *  'normalized': ['another'],
 *  'deps': ['tree']
 * };
 * 
 * System.import('app') 
 * // simultaneously starts loading all of:
 * // 'normalized', 'deps', 'another', 'tree'
 * // before "app" source is even loaded
 */

(function() {
  hookConstructor(function(constructor) {
    return function() {
      constructor.call(this);
      this.depCache = {};
    }
  });

  hook('locate', function(locate) {
    return function(load) {
      var loader = this;
      // load direct deps, in turn will pick up their trace trees
      var deps = loader.depCache[load.name];
      if (deps)
        for (var i = 0; i < deps.length; i++)
          loader.load(deps[i]);

      return locate.call(loader, load);
    };
  });
})();
  
/*
 * Conditions Extension
 *
 *   Allows a condition module to alter the resolution of an import via syntax:
 *
 *     import $ from 'jquery/#{browser}';
 *
 *   Will first load the module 'browser' via `System.import('browser')` and 
 *   take the default export of that module.
 *   If the default export is not a string, an error is thrown.
 * 
 *   We then substitute the string into the require to get the conditional resolution
 *   enabling environment-specific variations like:
 * 
 *     import $ from 'jquery/ie'
 *     import $ from 'jquery/firefox'
 *     import $ from 'jquery/chrome'
 *     import $ from 'jquery/safari'
 *
 *   It can be useful for a condition module to define multiple conditions.
 *   This can be done via the `|` modifier to specify a specific export:
 *
 *     import 'jquery/#{browser|grade}'
 *
 *   Where the `grade` export of the `browser` module is taken for substitution.
 *
 *
 * Boolean Conditionals
 *
 *   For polyfill modules, that are used as imports but have no module value,
 *   a binary conditional allows a module not to be loaded at all if not needed:
 *
 *     import 'es5-shim?{conditions/needs-es5shim}'
 *
 */
(function() {

  var conditionalRegEx = /#\{[^\}]+\}|\?\{[^\}]+\}$/;

  hook('normalize', function(normalize) {
    return function(name, parentName, parentAddress) {
      var loader = this;
      return normalize.call(loader, name, parentName, parentAddress)
      .then(function(normalized) {
        var conditionalMatch = normalized.match(conditionalRegEx);
        if (!conditionalMatch)
          return normalized;

        var conditionModule = conditionalMatch[0].substr(2, conditionalMatch[0].length - 3);
        var substitution = conditionalMatch[0].substr(0, 1) == '#';
        var conditionExport = 'default';

        var exportNameIndex = conditionModule.lastIndexOf('|');
        if (exportNameIndex) {
          conditionExport = conditionModule.substr(exportNameIndex + 1);
          conditionModule = conditionModule.substr(0, exportNameIndex);
        }
        
        return loader['import'](conditionModule, parentName)
        .then(function(m) {
          var conditionValue = m[conditionExport];

          if (substitution) {
            if (typeof conditionValue !== 'string')
              throw new TypeError('The condition value for ' + load.name + ' isn\'t resolving to a string.');
            return normalized.replace(conditionalRegEx, conditionValue);
          }
          else {
            if (typeof conditionValue !== 'boolean')
              throw new TypeError('The condition value for ' + load.name + ' isn\'t resolving to a boolean.');
            if (!conditionValue)
              return '@empty';
            return normalized;
          }
        });
      });
    };
  });

})();System = new SystemJSLoader();
System.constructor = SystemJSLoader;  // -- exporting --

  if (typeof exports === 'object')
    module.exports = Loader;

  __global.Reflect = __global.Reflect || {};
  __global.Reflect.Loader = __global.Reflect.Loader || Loader;
  __global.Reflect.global = __global.Reflect.global || __global;
  __global.LoaderPolyfill = Loader;

  if (!System) {
    System = new SystemLoader();
    System.constructor = SystemLoader;
  }

  if (typeof exports === 'object')
    module.exports = System;

  __global.System = System;

})(typeof window != 'undefined' ? window : (typeof WorkerGlobalScope != 'undefined' ? self : global));}

// auto-load Promise and URL polyfills if needed
if (typeof Promise === 'undefined' || typeof URL === 'undefined') {
  // document.write
  if (typeof document !== 'undefined') {
    var scripts = document.getElementsByTagName('script');
    $__curScript = scripts[scripts.length - 1];
    var curPath = $__curScript.src;
    var basePath = curPath.substr(0, curPath.lastIndexOf('/') + 1);
    window.systemJSBootstrap = bootstrap;
    document.write(
      '<' + 'script type="text/javascript" src="' + basePath + 'polyfills.js">' + '<' + '/script>'
    );
  }
  // importScripts
  else if (typeof importScripts !== 'undefined') {
    var basePath = '';
    try {
      throw new Error('_');
    } catch (e) {
      e.stack.replace(/(?:at|@).*(http.+):[\d]+:[\d]+/, function(m, url) {
        basePath = url.replace(/\/[^\/]*$/, '/');
      });
    }
    importScripts(basePath + 'polyfills.js');
    bootstrap();
  }
}
else {
  bootstrap();
}


})();