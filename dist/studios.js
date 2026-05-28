// modules are defined as an array
// [ module function, map of requires ]
//
// map of requires is short require name -> numeric require
//
// anything defined in a previous bundle is accessed via the
// orig method which is the require for previous bundles

(function (
  modules,
  entry,
  mainEntry,
  parcelRequireName,
  externals,
  distDir,
  publicUrl,
  devServer
) {
  /* eslint-disable no-undef */
  var globalObject =
    typeof globalThis !== 'undefined'
      ? globalThis
      : typeof self !== 'undefined'
      ? self
      : typeof window !== 'undefined'
      ? window
      : typeof global !== 'undefined'
      ? global
      : {};
  /* eslint-enable no-undef */

  // Save the require from previous bundle to this closure if any
  var previousRequire =
    typeof globalObject[parcelRequireName] === 'function' &&
    globalObject[parcelRequireName];

  var importMap = previousRequire.i || {};
  var cache = previousRequire.cache || {};
  // Do not use `require` to prevent Webpack from trying to bundle this call
  var nodeRequire =
    typeof module !== 'undefined' &&
    typeof module.require === 'function' &&
    module.require.bind(module);

  function newRequire(name, jumped) {
    if (!cache[name]) {
      if (!modules[name]) {
        if (externals[name]) {
          return externals[name];
        }
        // if we cannot find the module within our internal map or
        // cache jump to the current global require ie. the last bundle
        // that was added to the page.
        var currentRequire =
          typeof globalObject[parcelRequireName] === 'function' &&
          globalObject[parcelRequireName];
        if (!jumped && currentRequire) {
          return currentRequire(name, true);
        }

        // If there are other bundles on this page the require from the
        // previous one is saved to 'previousRequire'. Repeat this as
        // many times as there are bundles until the module is found or
        // we exhaust the require chain.
        if (previousRequire) {
          return previousRequire(name, true);
        }

        // Try the node require function if it exists.
        if (nodeRequire && typeof name === 'string') {
          return nodeRequire(name);
        }

        var err = new Error("Cannot find module '" + name + "'");
        err.code = 'MODULE_NOT_FOUND';
        throw err;
      }

      localRequire.resolve = resolve;
      localRequire.cache = {};

      var module = (cache[name] = new newRequire.Module(name));

      modules[name][0].call(
        module.exports,
        localRequire,
        module,
        module.exports,
        globalObject
      );
    }

    return cache[name].exports;

    function localRequire(x) {
      var res = localRequire.resolve(x);
      if (res === false) {
        return {};
      }
      // Synthesize a module to follow re-exports.
      if (Array.isArray(res)) {
        var m = {__esModule: true};
        res.forEach(function (v) {
          var key = v[0];
          var id = v[1];
          var exp = v[2] || v[0];
          var x = newRequire(id);
          if (key === '*') {
            Object.keys(x).forEach(function (key) {
              if (
                key === 'default' ||
                key === '__esModule' ||
                Object.prototype.hasOwnProperty.call(m, key)
              ) {
                return;
              }

              Object.defineProperty(m, key, {
                enumerable: true,
                get: function () {
                  return x[key];
                },
              });
            });
          } else if (exp === '*') {
            Object.defineProperty(m, key, {
              enumerable: true,
              value: x,
            });
          } else {
            Object.defineProperty(m, key, {
              enumerable: true,
              get: function () {
                if (exp === 'default') {
                  return x.__esModule ? x.default : x;
                }
                return x[exp];
              },
            });
          }
        });
        return m;
      }
      return newRequire(res);
    }

    function resolve(x) {
      var id = modules[name][1][x];
      return id != null ? id : x;
    }
  }

  function Module(moduleName) {
    this.id = moduleName;
    this.bundle = newRequire;
    this.require = nodeRequire;
    this.exports = {};
  }

  newRequire.isParcelRequire = true;
  newRequire.Module = Module;
  newRequire.modules = modules;
  newRequire.cache = cache;
  newRequire.parent = previousRequire;
  newRequire.distDir = distDir;
  newRequire.publicUrl = publicUrl;
  newRequire.devServer = devServer;
  newRequire.i = importMap;
  newRequire.register = function (id, exports) {
    modules[id] = [
      function (require, module) {
        module.exports = exports;
      },
      {},
    ];
  };

  // Only insert newRequire.load when it is actually used.
  // The code in this file is linted against ES5, so dynamic import is not allowed.
  // INSERT_LOAD_HERE

  Object.defineProperty(newRequire, 'root', {
    get: function () {
      return globalObject[parcelRequireName];
    },
  });

  globalObject[parcelRequireName] = newRequire;

  for (var i = 0; i < entry.length; i++) {
    newRequire(entry[i]);
  }

  if (mainEntry) {
    // Expose entry point to Node, AMD or browser globals
    // Based on https://github.com/ForbesLindesay/umd/blob/master/template.js
    var mainExports = newRequire(mainEntry);

    // CommonJS
    if (typeof exports === 'object' && typeof module !== 'undefined') {
      module.exports = mainExports;

      // RequireJS
    } else if (typeof define === 'function' && define.amd) {
      define(function () {
        return mainExports;
      });
    }
  }
})({"ctcwF":[function(require,module,exports,__globalThis) {
var global = arguments[3];
var HMR_HOST = null;
var HMR_PORT = null;
var HMR_SERVER_PORT = 1234;
var HMR_SECURE = false;
var HMR_ENV_HASH = "d6ea1d42532a7575";
var HMR_USE_SSE = false;
module.bundle.HMR_BUNDLE_ID = "65d5d5c9ad3b8088";
"use strict";
/* global HMR_HOST, HMR_PORT, HMR_SERVER_PORT, HMR_ENV_HASH, HMR_SECURE, HMR_USE_SSE, chrome, browser, __parcel__import__, __parcel__importScripts__, ServiceWorkerGlobalScope */ /*::
import type {
  HMRAsset,
  HMRMessage,
} from '@parcel/reporter-dev-server/src/HMRServer.js';
interface ParcelRequire {
  (string): mixed;
  cache: {|[string]: ParcelModule|};
  hotData: {|[string]: mixed|};
  Module: any;
  parent: ?ParcelRequire;
  isParcelRequire: true;
  modules: {|[string]: [Function, {|[string]: string|}]|};
  HMR_BUNDLE_ID: string;
  root: ParcelRequire;
}
interface ParcelModule {
  hot: {|
    data: mixed,
    accept(cb: (Function) => void): void,
    dispose(cb: (mixed) => void): void,
    // accept(deps: Array<string> | string, cb: (Function) => void): void,
    // decline(): void,
    _acceptCallbacks: Array<(Function) => void>,
    _disposeCallbacks: Array<(mixed) => void>,
  |};
}
interface ExtensionContext {
  runtime: {|
    reload(): void,
    getURL(url: string): string;
    getManifest(): {manifest_version: number, ...};
  |};
}
declare var module: {bundle: ParcelRequire, ...};
declare var HMR_HOST: string;
declare var HMR_PORT: string;
declare var HMR_SERVER_PORT: string;
declare var HMR_ENV_HASH: string;
declare var HMR_SECURE: boolean;
declare var HMR_USE_SSE: boolean;
declare var chrome: ExtensionContext;
declare var browser: ExtensionContext;
declare var __parcel__import__: (string) => Promise<void>;
declare var __parcel__importScripts__: (string) => Promise<void>;
declare var globalThis: typeof self;
declare var ServiceWorkerGlobalScope: Object;
*/ var OVERLAY_ID = '__parcel__error__overlay__';
var OldModule = module.bundle.Module;
function Module(moduleName) {
    OldModule.call(this, moduleName);
    this.hot = {
        data: module.bundle.hotData[moduleName],
        _acceptCallbacks: [],
        _disposeCallbacks: [],
        accept: function(fn) {
            this._acceptCallbacks.push(fn || function() {});
        },
        dispose: function(fn) {
            this._disposeCallbacks.push(fn);
        }
    };
    module.bundle.hotData[moduleName] = undefined;
}
module.bundle.Module = Module;
module.bundle.hotData = {};
var checkedAssets /*: {|[string]: boolean|} */ , disposedAssets /*: {|[string]: boolean|} */ , assetsToDispose /*: Array<[ParcelRequire, string]> */ , assetsToAccept /*: Array<[ParcelRequire, string]> */ , bundleNotFound = false;
function getHostname() {
    return HMR_HOST || (typeof location !== 'undefined' && location.protocol.indexOf('http') === 0 ? location.hostname : 'localhost');
}
function getPort() {
    return HMR_PORT || (typeof location !== 'undefined' ? location.port : HMR_SERVER_PORT);
}
// eslint-disable-next-line no-redeclare
let WebSocket = globalThis.WebSocket;
if (!WebSocket && typeof module.bundle.root === 'function') try {
    // eslint-disable-next-line no-global-assign
    WebSocket = module.bundle.root('ws');
} catch  {
// ignore.
}
var hostname = getHostname();
var port = getPort();
var protocol = HMR_SECURE || typeof location !== 'undefined' && location.protocol === 'https:' && ![
    'localhost',
    '127.0.0.1',
    '0.0.0.0'
].includes(hostname) ? 'wss' : 'ws';
// eslint-disable-next-line no-redeclare
var parent = module.bundle.parent;
if (!parent || !parent.isParcelRequire) {
    // Web extension context
    var extCtx = typeof browser === 'undefined' ? typeof chrome === 'undefined' ? null : chrome : browser;
    // Safari doesn't support sourceURL in error stacks.
    // eval may also be disabled via CSP, so do a quick check.
    var supportsSourceURL = false;
    try {
        (0, eval)('throw new Error("test"); //# sourceURL=test.js');
    } catch (err) {
        supportsSourceURL = err.stack.includes('test.js');
    }
    var ws;
    if (HMR_USE_SSE) ws = new EventSource('/__parcel_hmr');
    else try {
        // If we're running in the dev server's node runner, listen for messages on the parent port.
        let { workerData, parentPort } = module.bundle.root('node:worker_threads') /*: any*/ ;
        if (workerData !== null && workerData !== void 0 && workerData.__parcel) {
            parentPort.on('message', async (message)=>{
                try {
                    await handleMessage(message);
                    parentPort.postMessage('updated');
                } catch  {
                    parentPort.postMessage('restart');
                }
            });
            // After the bundle has finished running, notify the dev server that the HMR update is complete.
            queueMicrotask(()=>parentPort.postMessage('ready'));
        }
    } catch  {
        if (typeof WebSocket !== 'undefined') try {
            ws = new WebSocket(protocol + '://' + hostname + (port ? ':' + port : '') + '/');
        } catch (err) {
            // Ignore cloudflare workers error.
            if (err.message && !err.message.includes('Disallowed operation called within global scope')) console.error(err.message);
        }
    }
    if (ws) {
        // $FlowFixMe
        ws.onmessage = async function(event /*: {data: string, ...} */ ) {
            var data /*: HMRMessage */  = JSON.parse(event.data);
            await handleMessage(data);
        };
        if (ws instanceof WebSocket) {
            ws.onerror = function(e) {
                if (e.message) console.error(e.message);
            };
            ws.onclose = function() {
                console.warn("[parcel] \uD83D\uDEA8 Connection to the HMR server was lost");
            };
        }
    }
}
async function handleMessage(data /*: HMRMessage */ ) {
    checkedAssets = {} /*: {|[string]: boolean|} */ ;
    disposedAssets = {} /*: {|[string]: boolean|} */ ;
    assetsToAccept = [];
    assetsToDispose = [];
    bundleNotFound = false;
    if (data.type === 'reload') fullReload();
    else if (data.type === 'update') {
        // Remove error overlay if there is one
        if (typeof document !== 'undefined') removeErrorOverlay();
        let assets = data.assets;
        // Handle HMR Update
        let handled = assets.every((asset)=>{
            return asset.type === 'css' || asset.type === 'js' && hmrAcceptCheck(module.bundle.root, asset.id, asset.depsByBundle);
        });
        // Dispatch a custom event in case a bundle was not found. This might mean
        // an asset on the server changed and we should reload the page. This event
        // gives the client an opportunity to refresh without losing state
        // (e.g. via React Server Components). If e.preventDefault() is not called,
        // we will trigger a full page reload.
        if (handled && bundleNotFound && assets.some((a)=>a.envHash !== HMR_ENV_HASH) && typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') handled = !window.dispatchEvent(new CustomEvent('parcelhmrreload', {
            cancelable: true
        }));
        if (handled) {
            console.clear();
            // Dispatch custom event so other runtimes (e.g React Refresh) are aware.
            if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') window.dispatchEvent(new CustomEvent('parcelhmraccept'));
            await hmrApplyUpdates(assets);
            hmrDisposeQueue();
            // Run accept callbacks. This will also re-execute other disposed assets in topological order.
            let processedAssets = {};
            for(let i = 0; i < assetsToAccept.length; i++){
                let id = assetsToAccept[i][1];
                if (!processedAssets[id]) {
                    hmrAccept(assetsToAccept[i][0], id);
                    processedAssets[id] = true;
                }
            }
        } else fullReload();
    }
    if (data.type === 'error') {
        // Log parcel errors to console
        for (let ansiDiagnostic of data.diagnostics.ansi){
            let stack = ansiDiagnostic.codeframe ? ansiDiagnostic.codeframe : ansiDiagnostic.stack;
            console.error("\uD83D\uDEA8 [parcel]: " + ansiDiagnostic.message + '\n' + stack + '\n\n' + ansiDiagnostic.hints.join('\n'));
        }
        if (typeof document !== 'undefined') {
            // Render the fancy html overlay
            removeErrorOverlay();
            var overlay = createErrorOverlay(data.diagnostics.html);
            // $FlowFixMe
            document.body.appendChild(overlay);
        }
    }
}
function removeErrorOverlay() {
    var overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
        overlay.remove();
        console.log("[parcel] \u2728 Error resolved");
    }
}
function createErrorOverlay(diagnostics) {
    var overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    let errorHTML = '<div style="background: black; opacity: 0.85; font-size: 16px; color: white; position: fixed; height: 100%; width: 100%; top: 0px; left: 0px; padding: 30px; font-family: Menlo, Consolas, monospace; z-index: 9999;">';
    for (let diagnostic of diagnostics){
        let stack = diagnostic.frames.length ? diagnostic.frames.reduce((p, frame)=>{
            return `${p}
<a href="${protocol === 'wss' ? 'https' : 'http'}://${hostname}:${port}/__parcel_launch_editor?file=${encodeURIComponent(frame.location)}" style="text-decoration: underline; color: #888" onclick="fetch(this.href); return false">${frame.location}</a>
${frame.code}`;
        }, '') : diagnostic.stack;
        errorHTML += `
      <div>
        <div style="font-size: 18px; font-weight: bold; margin-top: 20px;">
          \u{1F6A8} ${diagnostic.message}
        </div>
        <pre>${stack}</pre>
        <div>
          ${diagnostic.hints.map((hint)=>"<div>\uD83D\uDCA1 " + hint + '</div>').join('')}
        </div>
        ${diagnostic.documentation ? `<div>\u{1F4DD} <a style="color: violet" href="${diagnostic.documentation}" target="_blank">Learn more</a></div>` : ''}
      </div>
    `;
    }
    errorHTML += '</div>';
    overlay.innerHTML = errorHTML;
    return overlay;
}
function fullReload() {
    if (typeof location !== 'undefined' && 'reload' in location) location.reload();
    else if (typeof extCtx !== 'undefined' && extCtx && extCtx.runtime && extCtx.runtime.reload) extCtx.runtime.reload();
    else try {
        let { workerData, parentPort } = module.bundle.root('node:worker_threads') /*: any*/ ;
        if (workerData !== null && workerData !== void 0 && workerData.__parcel) parentPort.postMessage('restart');
    } catch (err) {
        console.error("[parcel] \u26A0\uFE0F An HMR update was not accepted. Please restart the process.");
    }
}
function getParents(bundle, id) /*: Array<[ParcelRequire, string]> */ {
    var modules = bundle.modules;
    if (!modules) return [];
    var parents = [];
    var k, d, dep;
    for(k in modules)for(d in modules[k][1]){
        dep = modules[k][1][d];
        if (dep === id || Array.isArray(dep) && dep[dep.length - 1] === id) parents.push([
            bundle,
            k
        ]);
    }
    if (bundle.parent) parents = parents.concat(getParents(bundle.parent, id));
    return parents;
}
function updateLink(link) {
    var href = link.getAttribute('href');
    if (!href) return;
    var newLink = link.cloneNode();
    newLink.onload = function() {
        if (link.parentNode !== null) // $FlowFixMe
        link.parentNode.removeChild(link);
    };
    newLink.setAttribute('href', // $FlowFixMe
    href.split('?')[0] + '?' + Date.now());
    // $FlowFixMe
    link.parentNode.insertBefore(newLink, link.nextSibling);
}
var cssTimeout = null;
function reloadCSS() {
    if (cssTimeout || typeof document === 'undefined') return;
    cssTimeout = setTimeout(function() {
        var links = document.querySelectorAll('link[rel="stylesheet"]');
        for(var i = 0; i < links.length; i++){
            // $FlowFixMe[incompatible-type]
            var href /*: string */  = links[i].getAttribute('href');
            var hostname = getHostname();
            var servedFromHMRServer = hostname === 'localhost' ? new RegExp('^(https?:\\/\\/(0.0.0.0|127.0.0.1)|localhost):' + getPort()).test(href) : href.indexOf(hostname + ':' + getPort());
            var absolute = /^https?:\/\//i.test(href) && href.indexOf(location.origin) !== 0 && !servedFromHMRServer;
            if (!absolute) updateLink(links[i]);
        }
        cssTimeout = null;
    }, 50);
}
function hmrDownload(asset) {
    if (asset.type === 'js') {
        if (typeof document !== 'undefined') {
            let script = document.createElement('script');
            script.src = asset.url + '?t=' + Date.now();
            if (asset.outputFormat === 'esmodule') script.type = 'module';
            return new Promise((resolve, reject)=>{
                var _document$head;
                script.onload = ()=>resolve(script);
                script.onerror = reject;
                (_document$head = document.head) === null || _document$head === void 0 || _document$head.appendChild(script);
            });
        } else if (typeof importScripts === 'function') {
            // Worker scripts
            if (asset.outputFormat === 'esmodule') return import(asset.url + '?t=' + Date.now());
            else return new Promise((resolve, reject)=>{
                try {
                    importScripts(asset.url + '?t=' + Date.now());
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
        }
    }
}
async function hmrApplyUpdates(assets) {
    global.parcelHotUpdate = Object.create(null);
    let scriptsToRemove;
    try {
        // If sourceURL comments aren't supported in eval, we need to load
        // the update from the dev server over HTTP so that stack traces
        // are correct in errors/logs. This is much slower than eval, so
        // we only do it if needed (currently just Safari).
        // https://bugs.webkit.org/show_bug.cgi?id=137297
        // This path is also taken if a CSP disallows eval.
        if (!supportsSourceURL) {
            let promises = assets.map((asset)=>{
                var _hmrDownload;
                return (_hmrDownload = hmrDownload(asset)) === null || _hmrDownload === void 0 ? void 0 : _hmrDownload.catch((err)=>{
                    // Web extension fix
                    if (extCtx && extCtx.runtime && extCtx.runtime.getManifest().manifest_version == 3 && typeof ServiceWorkerGlobalScope != 'undefined' && global instanceof ServiceWorkerGlobalScope) {
                        extCtx.runtime.reload();
                        return;
                    }
                    throw err;
                });
            });
            scriptsToRemove = await Promise.all(promises);
        }
        assets.forEach(function(asset) {
            hmrApply(module.bundle.root, asset);
        });
    } finally{
        delete global.parcelHotUpdate;
        if (scriptsToRemove) scriptsToRemove.forEach((script)=>{
            if (script) {
                var _document$head2;
                (_document$head2 = document.head) === null || _document$head2 === void 0 || _document$head2.removeChild(script);
            }
        });
    }
}
function hmrApply(bundle /*: ParcelRequire */ , asset /*:  HMRAsset */ ) {
    var modules = bundle.modules;
    if (!modules) return;
    if (asset.type === 'css') reloadCSS();
    else if (asset.type === 'js') {
        let deps = asset.depsByBundle[bundle.HMR_BUNDLE_ID];
        if (deps) {
            if (modules[asset.id]) {
                // Remove dependencies that are removed and will become orphaned.
                // This is necessary so that if the asset is added back again, the cache is gone, and we prevent a full page reload.
                let oldDeps = modules[asset.id][1];
                for(let dep in oldDeps)if (!deps[dep] || deps[dep] !== oldDeps[dep]) {
                    let id = oldDeps[dep];
                    let parents = getParents(module.bundle.root, id);
                    if (parents.length === 1) hmrDelete(module.bundle.root, id);
                }
            }
            if (supportsSourceURL) // Global eval. We would use `new Function` here but browser
            // support for source maps is better with eval.
            (0, eval)(asset.output);
            // $FlowFixMe
            let fn = global.parcelHotUpdate[asset.id];
            modules[asset.id] = [
                fn,
                deps
            ];
        }
        // Always traverse to the parent bundle, even if we already replaced the asset in this bundle.
        // This is required in case modules are duplicated. We need to ensure all instances have the updated code.
        if (bundle.parent) hmrApply(bundle.parent, asset);
    }
}
function hmrDelete(bundle, id) {
    let modules = bundle.modules;
    if (!modules) return;
    if (modules[id]) {
        // Collect dependencies that will become orphaned when this module is deleted.
        let deps = modules[id][1];
        let orphans = [];
        for(let dep in deps){
            let parents = getParents(module.bundle.root, deps[dep]);
            if (parents.length === 1) orphans.push(deps[dep]);
        }
        // Delete the module. This must be done before deleting dependencies in case of circular dependencies.
        delete modules[id];
        delete bundle.cache[id];
        // Now delete the orphans.
        orphans.forEach((id)=>{
            hmrDelete(module.bundle.root, id);
        });
    } else if (bundle.parent) hmrDelete(bundle.parent, id);
}
function hmrAcceptCheck(bundle /*: ParcelRequire */ , id /*: string */ , depsByBundle /*: ?{ [string]: { [string]: string } }*/ ) {
    checkedAssets = {};
    if (hmrAcceptCheckOne(bundle, id, depsByBundle)) return true;
    // Traverse parents breadth first. All possible ancestries must accept the HMR update, or we'll reload.
    let parents = getParents(module.bundle.root, id);
    let accepted = false;
    while(parents.length > 0){
        let v = parents.shift();
        let a = hmrAcceptCheckOne(v[0], v[1], null);
        if (a) // If this parent accepts, stop traversing upward, but still consider siblings.
        accepted = true;
        else if (a !== null) {
            // Otherwise, queue the parents in the next level upward.
            let p = getParents(module.bundle.root, v[1]);
            if (p.length === 0) {
                // If there are no parents, then we've reached an entry without accepting. Reload.
                accepted = false;
                break;
            }
            parents.push(...p);
        }
    }
    return accepted;
}
function hmrAcceptCheckOne(bundle /*: ParcelRequire */ , id /*: string */ , depsByBundle /*: ?{ [string]: { [string]: string } }*/ ) {
    var modules = bundle.modules;
    if (!modules) return;
    if (depsByBundle && !depsByBundle[bundle.HMR_BUNDLE_ID]) {
        // If we reached the root bundle without finding where the asset should go,
        // there's nothing to do. Mark as "accepted" so we don't reload the page.
        if (!bundle.parent) {
            bundleNotFound = true;
            return true;
        }
        return hmrAcceptCheckOne(bundle.parent, id, depsByBundle);
    }
    if (checkedAssets[id]) return null;
    checkedAssets[id] = true;
    var cached = bundle.cache[id];
    if (!cached) return true;
    assetsToDispose.push([
        bundle,
        id
    ]);
    if (cached && cached.hot && cached.hot._acceptCallbacks.length) {
        assetsToAccept.push([
            bundle,
            id
        ]);
        return true;
    }
    return false;
}
function hmrDisposeQueue() {
    // Dispose all old assets.
    for(let i = 0; i < assetsToDispose.length; i++){
        let id = assetsToDispose[i][1];
        if (!disposedAssets[id]) {
            hmrDispose(assetsToDispose[i][0], id);
            disposedAssets[id] = true;
        }
    }
    assetsToDispose = [];
}
function hmrDispose(bundle /*: ParcelRequire */ , id /*: string */ ) {
    var cached = bundle.cache[id];
    bundle.hotData[id] = {};
    if (cached && cached.hot) cached.hot.data = bundle.hotData[id];
    if (cached && cached.hot && cached.hot._disposeCallbacks.length) cached.hot._disposeCallbacks.forEach(function(cb) {
        cb(bundle.hotData[id]);
    });
    delete bundle.cache[id];
}
function hmrAccept(bundle /*: ParcelRequire */ , id /*: string */ ) {
    // Execute the module.
    bundle(id);
    // Run the accept callbacks in the new version of the module.
    var cached = bundle.cache[id];
    if (cached && cached.hot && cached.hot._acceptCallbacks.length) {
        let assetsToAlsoAccept = [];
        cached.hot._acceptCallbacks.forEach(function(cb) {
            let additionalAssets = cb(function() {
                return getParents(module.bundle.root, id);
            });
            if (Array.isArray(additionalAssets) && additionalAssets.length) assetsToAlsoAccept.push(...additionalAssets);
        });
        if (assetsToAlsoAccept.length) {
            let handled = assetsToAlsoAccept.every(function(a) {
                return hmrAcceptCheck(a[0], a[1]);
            });
            if (!handled) return fullReload();
            hmrDisposeQueue();
        }
    }
}

},{}],"efEHR":[function(require,module,exports,__globalThis) {
// Studios Map — renders a Mapbox GL map per Finsweet `studios` list instance,
// reacting to filter / sort / load changes. Clusters items client-side with
// supercluster so each point + cluster stays as a DOM-based HTML marker.
//
// Mapbox GL + supercluster are loaded LAZILY by this module (see
// loadMapboxLibs) the first time the map scrolls into view — they must NOT be
// added as blocking <script> tags in the Webflow <head>, or the 460 KB +
// ~25 s of eval lands back on the critical path and the lazy-load is moot.
// Only the bottom-sheet web component still needs registering up front:
// <script type="module">
//import { registerSheetElements } from "https://cdn.jsdelivr.net/npm/pure-web-bottom-sheet@0.6.0/dist/web.client.js";
// registerSheetElements();
// </script>
var _locationJs = require("./location.js");
var _studiosFilterCountJs = require("./studios-filter-count.js");
var _studiosDeepLinkJs = require("./studios-deep-link.js");
var _mapboxJs = require("./mapbox.js");
var _studiosCityFilterJs = require("./studios-city-filter.js");
const FS_LIST_INSTANCE_KEY = "studios";
// Supercluster is the list page's only extra CDN dep beyond mapbox-gl (loaded
// lazily by ./mapbox.js); kept out of the Webflow <head> so it doesn't block
// first paint and loaded on demand when the map is first revealed.
const SUPERCLUSTER_JS_URL = "https://unpkg.com/supercluster@8.0.0/dist/supercluster.min.js";
const DEFAULT_CENTER = [
    18.0686,
    59.3293
]; // Stockholm
// Zoom levels above ~5 put globe projection past its flat-transition point,
// which is where cursor-anchored scroll zoom works correctly. At <5 on globe,
// the cursor often falls in "space" and Mapbox falls back to center-anchored
// zoom — feeling like the zoom ignores your cursor.
const ZOOM_CONFIG = {
    desktop: 5.5,
    mobile: 5.0,
    breakpoint: 480
};
// Layout breakpoint — mirrors the CSS `@container (width < 50em)` on the
// studios component. "Desktop" layout kicks in at component inline-size ≥ 50em
// (sidebar + map); below that, content collapses into the bottom sheet. Stays
// in em so the JS threshold tracks the CSS — if the component's font-size
// changes, both sides move together.
const LAYOUT_BREAKPOINT_EM = 50;
const FIT_BOUNDS_CONFIG = {
    duration: 500,
    maxZoom: 12
};
const FIT_BOUNDS_BREATHING_ROOM = 24;
const MARKER_FADE_DURATION = 250;
const USER_LOCATION_ZOOM = 11;
const CITY_ZOOM = 11;
const CLUSTER_CONFIG = {
    radius: 50,
    maxZoom: 14,
    minPoints: 6
};
const CLUSTER_EXPANSION_PADDING = 0.5; // extra zoom beyond expansionZoom
// Filtered-count display: counts above this collapse to the "over" copy
// ("Over 1000 studios") instead of the exact number. Each Webflow locale
// authors the surrounding copy directly in Designer — the number is the
// only thing JS injects, into [data-studios-count-slot].
const OVER_COUNT_THRESHOLD = 1000;
const POPUP_CLASS = "studios-popup";
const SHEET_HEIGHT_VAR = "--studios-sheet-height";
const SHEET_CHANGING_CLASS = "studios-sheet-changing";
const SHEET_READY_CLASS = "studios-sheet-ready";
const SHEET_SETTLE_DEBOUNCE_MS = 120;
// Cheap filters resolve synchronously and a "filtering" flash would just
// strobe. We only commit to the filtering state if the render hasn't
// landed within this window.
const FILTERING_DELAY_MS = 80;
const S = {
    component: '[data-studios-element="component"]',
    mapTarget: '[data-studios-element="map-target"]',
    marker: '[data-studios-element="marker"]',
    popup: '[data-studios-element="popup"]',
    clusterTemplate: '[data-studios-element="cluster-template"]',
    locateButton: '[data-studios-element="locate"]',
    searchAreaButton: '[data-studios-element="search-area"]',
    userLocationTemplate: '[data-studios-element="user-location-template"]',
    sheet: '[data-studios-element="sheet"]',
    content: '[data-studios-element="content"]',
    contentDesktop: '[data-studios-element="content-desktop"]',
    contentMobile: '[data-studios-element="content-mobile"]',
    count: '[data-studios-field="count"]',
    lat: '[data-studios-field="lat"]',
    lng: '[data-studios-field="lng"]',
    id: '[data-studios-field="id"]',
    countDisplay: '[data-studios-element="count-display"]',
    countMode: "[data-studios-count-mode]",
    countSlot: "[data-studios-count-slot]"
};
let mapboxgl = null;
const initializedInstances = new WeakSet();
// Loads mapbox-gl (via the shared ./mapbox.js loader) + supercluster on first
// call and caches the promise so every studios instance awaits the same single
// load. Sets the module `mapboxgl` reference once ready.
let mapboxLibsPromise = null;
function loadMapboxLibs() {
    if (mapboxLibsPromise) return mapboxLibsPromise;
    mapboxLibsPromise = (async ()=>{
        const [gl] = await Promise.all([
            (0, _mapboxJs.loadMapboxGl)(),
            window.Supercluster ? Promise.resolve() : (0, _mapboxJs.loadScriptOnce)(SUPERCLUSTER_JS_URL)
        ]);
        mapboxgl = gl;
    })();
    return mapboxLibsPromise;
}
function getResponsiveZoom() {
    return window.innerWidth <= ZOOM_CONFIG.breakpoint ? ZOOM_CONFIG.mobile : ZOOM_CONFIG.desktop;
}
// null when city.js hasn't booted yet or the active city has no lat/lng
// configured — callers fall back to DEFAULT_CENTER / fit-to-features.
function getSelectedCityCoords() {
    const api = /** @type {any} */ window.bruce?.city;
    if (!api) return null;
    const slug = api.get();
    return api.all().find((c)=>c.slug === slug)?.coords ?? null;
}
function getClusterSizeTier(count) {
    if (count < 10) return "sm";
    if (count < 50) return "md";
    if (count < 200) return "lg";
    return "xl";
}
function applyClusterMeta(el, count, countSlotSelector) {
    if (!(el instanceof HTMLElement)) return;
    el.dataset.size = getClusterSizeTier(count);
    el.style.setProperty("--studios-cluster-count", String(count));
    const slot = countSlotSelector ? el.querySelector(countSlotSelector) : null;
    if (slot) slot.textContent = String(count);
}
// Webflow CMS values are immutable post-render, so parsing once per element
// is safe; WeakMap auto-GCs when items leave the DOM.
const featureCache = new WeakMap();
function extractOne(el) {
    if (featureCache.has(el)) return featureCache.get(el);
    const latEl = el.querySelector(S.lat);
    const lngEl = el.querySelector(S.lng);
    if (!latEl || !lngEl) {
        featureCache.set(el, null);
        return null;
    }
    const lat = parseFloat(latEl.textContent);
    const lng = parseFloat(lngEl.textContent);
    if (isNaN(lat) || isNaN(lng)) {
        featureCache.set(el, null);
        return null;
    }
    const markerEl = el.querySelector(S.marker);
    if (!markerEl) {
        featureCache.set(el, null);
        return null;
    }
    const idEl = el.querySelector(S.id);
    const feature = {
        coordinates: [
            lng,
            lat
        ],
        id: idEl ? idEl.textContent.trim() : "",
        markerEl,
        popupEl: el.querySelector(S.popup)
    };
    featureCache.set(el, feature);
    return feature;
}
// Gate the skip-warning to once per session (extractFeatures runs often).
let hasWarnedAboutSkipped = false;
function extractFeatures(elements) {
    const features = [];
    let skipped = 0;
    elements.forEach((el)=>{
        const one = extractOne(el);
        if (one) features.push(one);
        else skipped++;
    });
    if (skipped && !hasWarnedAboutSkipped) {
        hasWarnedAboutSkipped = true;
        console.warn(`[studios-map] Extracted ${features.length} / ${elements.length} items. Skipped ${skipped} with missing or invalid ${S.lat} / ${S.lng} / ${S.marker}. (Logged once per session.)`);
    }
    return features;
}
// Deep-clones a per-item template. Cloning (vs moving) keeps the source intact
// so Webflow CMS bindings stay in place and the element can be rendered repeatedly.
function cloneTemplate(sourceEl) {
    if (!sourceEl) return null;
    const clone = sourceEl.cloneNode(true);
    if (clone instanceof HTMLElement) {
        // Clear inline display:none carried over from Designer.
        clone.style.display = "";
        // Avoid duplicate ids in the document once the clone is mounted.
        if (clone.id) clone.removeAttribute("id");
        clone.querySelectorAll("[id]").forEach((n)=>n.removeAttribute("id"));
        // Clones live on the map (markers / popups / cluster / user location);
        // they should never match template queries. Stripping the hook avoids
        // the "which one is the template?" ambiguity when re-querying.
        clone.removeAttribute("data-studios-element");
        clone.querySelectorAll("[data-studios-element]").forEach((n)=>n.removeAttribute("data-studios-element"));
    }
    return clone;
}
function buildMarkerElement(feature) {
    return cloneTemplate(feature.markerEl);
}
function buildPopupContent(feature) {
    return cloneTemplate(feature.popupEl);
}
function buildClusterElement(templateEl, count) {
    const clone = cloneTemplate(templateEl);
    applyClusterMeta(clone, count, S.count);
    return clone;
}
// Filtered-count display. Author once per component with three mode slots:
//   <div data-studios-element="count-display">
//     <span data-studios-count-mode="singular"><span data-studios-count-slot></span> studio</span>
//     <span data-studios-count-mode="plural"><span data-studios-count-slot></span> studios</span>
//     <span data-studios-count-mode="over">Over <span data-studios-count-slot></span> studios</span>
//   </div>
// JS picks the active mode by count, writes the number into that mode's slot,
// and toggles `hidden` on the others. Surrounding copy is plain DOM text, so
// Webflow Localization per-locale edits translate it with no JS changes.
function updateCountDisplay(component, count) {
    const display = component.querySelector(S.countDisplay);
    if (!display) return;
    const mode = count > OVER_COUNT_THRESHOLD ? "over" : count === 1 ? "singular" : "plural";
    const slotValue = mode === "over" ? OVER_COUNT_THRESHOLD : count;
    display.querySelectorAll(S.countMode).forEach((modeEl)=>{
        const isActive = modeEl.getAttribute("data-studios-count-mode") === mode;
        modeEl.hidden = !isActive;
        if (!isActive) return;
        const slot = modeEl.querySelector(S.countSlot);
        if (slot) slot.textContent = String(slotValue);
    });
}
function createMap(container) {
    return new mapboxgl.Map({
        container,
        style: (0, _mapboxJs.MAPBOX_STYLE),
        projection: "globe",
        center: getSelectedCityCoords() || DEFAULT_CENTER,
        zoom: getResponsiveZoom(),
        attributionControl: false
    });
}
function fitToFeatures(map, features, sheetCoverage = 0) {
    // Bottom padding equal to the sheet's overlap shifts the camera target up
    // so the centered point lands in the visible strip above the sheet
    // instead of behind it. Mapbox flyTo and fitBounds both use `padding` to
    // compute the camera target.
    const sheetPadding = {
        top: 0,
        right: 0,
        bottom: sheetCoverage,
        left: 0
    };
    if (!features.length) {
        map.flyTo({
            center: DEFAULT_CENTER,
            zoom: getResponsiveZoom(),
            duration: FIT_BOUNDS_CONFIG.duration,
            padding: sheetPadding
        });
        return;
    }
    if (features.length === 1) {
        map.flyTo({
            center: features[0].coordinates,
            zoom: 10,
            duration: FIT_BOUNDS_CONFIG.duration,
            padding: sheetPadding
        });
        return;
    }
    // Skip the fit if the canvas is too small to hold any breathing room —
    // fitBounds would either warn or land the camera at a degenerate position.
    const available = getCanvasSize(map, 100);
    if (!available) return;
    const visibleH = Math.max(0, available.h - sheetCoverage);
    const breathing = Math.min(FIT_BOUNDS_BREATHING_ROOM, visibleH / 2, available.w / 2);
    const padding = {
        top: breathing,
        bottom: breathing + sheetCoverage,
        left: breathing,
        right: breathing
    };
    const bounds = features.reduce((b, f)=>b.extend(f.coordinates), new mapboxgl.LngLatBounds());
    map.fitBounds(bounds, {
        ...FIT_BOUNDS_CONFIG,
        padding
    });
}
// Map canvas size, or null if smaller than `minSize` in either axis.
function getCanvasSize(map, minSize = 1) {
    const container = map.getContainer();
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w < minSize || h < minSize) return null;
    return {
        w,
        h
    };
}
// Container-query-equivalent check: true when the component's inline size
// reaches LAYOUT_BREAKPOINT_EM, measured in the component's OWN font-size
// (same base CSS container queries use for em). Read fresh each call so
// font-size or width changes are picked up without cached staleness.
function isDesktopLayout(component) {
    const fontSize = parseFloat(getComputedStyle(component).fontSize) || 16;
    return component.clientWidth >= LAYOUT_BREAKPOINT_EM * fontSize;
}
// Moves the `content` subtree (toolbar, list, filter panel) between two
// mount points (`content-desktop` and `content-mobile`) as the component
// crosses the layout breakpoint. Authored position is a sibling of both;
// this keeps the CMS list authored once and avoids Finsweet multi-instance
// issues. Finsweet binds by element reference, so re-parenting an attached
// subtree doesn't break list hooks.
//
// Driven by ResizeObserver on the component (not window matchMedia) so the
// crossover tracks the CSS container query, not the viewport.
function setupResponsiveContent(component) {
    const content = component.querySelector(S.content);
    if (!content) return;
    const desktopMount = component.querySelector(S.contentDesktop);
    const mobileMount = component.querySelector(S.contentMobile);
    if (!desktopMount && !mobileMount) return;
    const place = ()=>{
        const wantsDesktop = isDesktopLayout(component);
        // Fall back to whichever mount exists if the preferred one is missing
        // (desktop-only or mobile-only markup). If neither exists, bail.
        const target = wantsDesktop ? desktopMount || mobileMount : mobileMount || desktopMount;
        if (!target || content.parentElement === target) return;
        target.appendChild(content);
    };
    place();
    let lastIsDesktop = isDesktopLayout(component);
    const ro = new ResizeObserver(()=>{
        const next = isDesktopLayout(component);
        if (next === lastIsDesktop) return;
        lastIsDesktop = next;
        place();
    });
    ro.observe(component);
}
// Exposes the bottom-sheet chrome's visible height as `--studios-sheet-height`
// on <html>, so anything on the page can anchor "just above the sheet" via
// `bottom: calc(var(--studios-sheet-height) + 8px)`.
//
// While the height is actively changing, adds `studios-sheet-changing` to
// <html>. The CSS var lags the chrome's visual position by one frame, which
// looks jumpy mid-drag — CSS can use this class to hide anchored elements
// until things settle.
function setupSheetHeightVar(component, onSettle) {
    const sheet = component.querySelector(S.sheet);
    if (!sheet) return ()=>0;
    let chrome = null;
    const tag = sheet.tagName.toLowerCase();
    customElements.whenDefined(tag).then(()=>{
        chrome = sheet.shadowRoot?.querySelector('[part="sheet"]');
        if (!chrome) return;
        const root = document.documentElement;
        let pendingFrame = null;
        let lastHeight = -1;
        let settleTimer = null;
        let isChanging = false;
        const markChanging = ()=>{
            if (!isChanging) {
                isChanging = true;
                root.classList.add(SHEET_CHANGING_CLASS);
            }
            clearTimeout(settleTimer);
            settleTimer = setTimeout(()=>{
                isChanging = false;
                root.classList.remove(SHEET_CHANGING_CLASS);
                onSettle?.();
            }, SHEET_SETTLE_DEBOUNCE_MS);
        };
        const sync = ()=>{
            if (pendingFrame !== null) return;
            pendingFrame = requestAnimationFrame(()=>{
                pendingFrame = null;
                const h = chrome.getBoundingClientRect().height;
                if (Math.abs(h - lastHeight) < 1) return;
                lastHeight = h;
                root.style.setProperty(SHEET_HEIGHT_VAR, `${h}px`);
                // Marks first successful measurement so CSS can gate sheet-height
                // -dependent positioning (e.g. spinner offset) and avoid the
                // pre-init "var unset → fallback 0" → "var set → real value" jump.
                root.classList.add(SHEET_READY_CLASS);
                markChanging();
            });
        };
        sync();
        sheet.addEventListener("scroll", sync, {
            passive: true
        });
        sheet.addEventListener("snap-position-change", sync);
        new ResizeObserver(sync).observe(chrome);
    });
    // How many CSS pixels of `targetEl` are covered by the sheet chrome.
    // Returns 0 when there's no chrome yet, no horizontal overlap (e.g.
    // desktop sidebar layout where the sheet sits beside the map), or the
    // chrome sits below the target. Camera ops use this as bottom padding
    // so the centered point lands in the visible strip above the sheet.
    return (targetEl)=>{
        if (!chrome || !targetEl) return 0;
        const cRect = chrome.getBoundingClientRect();
        if (cRect.width === 0 || cRect.height === 0) return 0;
        const tRect = targetEl.getBoundingClientRect();
        const horizontalOverlap = Math.min(cRect.right, tRect.right) - Math.max(cRect.left, tRect.left);
        if (horizontalOverlap <= 0) return 0;
        const verticalOverlap = Math.max(0, tRect.bottom - cRect.top);
        return Math.min(verticalOverlap, tRect.height);
    };
}
function setupStudiosInstance(fsListInstance) {
    const component = fsListInstance.wrapperElement.closest(S.component);
    if (!component) {
        console.warn('[studios-map] No [data-studios-element="component"] ancestor for Finsweet list', fsListInstance.wrapperElement);
        return;
    }
    const mapTargetEl = component.querySelector(S.mapTarget);
    if (!mapTargetEl) {
        console.warn('[studios-map] Missing [data-studios-element="map-target"] inside', component);
        return;
    }
    const clusterTemplateEl = component.querySelector(S.clusterTemplate);
    if (!clusterTemplateEl) {
        console.warn(`[studios-map] Missing ${S.clusterTemplate} inside`, component);
        return;
    }
    if (!clusterTemplateEl.querySelector(S.count)) console.warn(`[studios-map] Cluster template has no ${S.count} slot \u{2014} the count won't update. Add data-studios-field="count" to a text element inside the cluster template.`);
    // data-state on the component drives all loading/ready styling.
    // CSS reads `[data-studios-element="component"][data-state="…"]`:
    //   loading   → initial CMS stream; before first render
    //   filtering → filter changed and render is in flight > FILTERING_DELAY_MS
    //   ready     → render done (the 0-result case is covered by the count
    //               display rendering "0 studios"; no separate empty state)
    let currentState = "loading";
    let filteringTimeoutId = null;
    component.dataset.state = currentState;
    function setState(next) {
        if (filteringTimeoutId !== null) {
            clearTimeout(filteringTimeoutId);
            filteringTimeoutId = null;
        }
        if (next === currentState) return;
        currentState = next;
        component.dataset.state = next;
    }
    function scheduleFilteringTransition() {
        // Initial load owns its state — never downgrade loading to filtering.
        if (currentState === "loading" || currentState === "filtering") return;
        if (filteringTimeoutId !== null) return;
        filteringTimeoutId = setTimeout(()=>{
            filteringTimeoutId = null;
            currentState = "filtering";
            component.dataset.state = "filtering";
        }, FILTERING_DELAY_MS);
    }
    // Duplicate locate / search-area buttons are expected: the desktop sidebar
    // and the mobile sheet each carry their own copy, and they live outside the
    // single `content` subtree that setupResponsiveContent moves, so both stay
    // in the DOM at once. Bind every copy and keep their state in sync so the
    // visible one always reflects reality regardless of layout.
    const locateButtonEls = /** @type {HTMLElement[]} */ [
        ...component.querySelectorAll(S.locateButton)
    ];
    const searchAreaButtonEls = /** @type {HTMLElement[]} */ [
        ...component.querySelectorAll(S.searchAreaButton)
    ];
    const userLocationTemplateEl = component.querySelector(S.userLocationTemplate);
    if (!userLocationTemplateEl) {
        console.warn(`[studios-map] Missing ${S.userLocationTemplate} inside`, component);
        return;
    }
    // Dirty flag on the search-area buttons — `.is-active` matches the
    // site-wide Finsweet convention (`fs-list-activeclass`). Toggled across all
    // copies so every duplicate shows the same dirty state.
    let searchAreaDirty = false;
    const setSearchAreaDirty = (dirty)=>{
        if (dirty === searchAreaDirty) return;
        searchAreaDirty = dirty;
        searchAreaButtonEls.forEach((el)=>el.classList.toggle("is-active", dirty));
    };
    // Map is created lazily (see ensureMap, wired up after the hooks below) the
    // first time the map scrolls into view, so mapbox-gl's bytes + eval stay off
    // the initial critical path. Until then `map` is null and every map-touching
    // path is gated by `isLoaded` (false until `map.on("load")`), so the list,
    // filters, counts and card paint all work with no map present.
    let map = null;
    setupResponsiveContent(component);
    // Sheet coverage is read fresh on each explicit camera op (fit, locate,
    // marker / cluster click) — no auto-easeTo on sheet drag, so the user's
    // chosen view stays put when they resize the sheet. On settle we just
    // re-run renderClusters so markers reflect the new visible area.
    const getSheetCoverage = setupSheetHeightVar(component, ()=>{
        if (isLoaded) renderClusters();
    });
    const sheetCoverage = ()=>getSheetCoverage(mapTargetEl);
    const sheetPadding = ()=>({
            bottom: sheetCoverage()
        });
    // Reusing the same DOM element across renders lets Mapbox move markers with
    // `setLngLat` (smooth) and lets CSS transitions animate on the same element.
    const clusterMarkers = new Map(); // cluster_id -> entry
    const pointMarkers = new Map(); // feature id (or coord fallback) -> entry
    let activePopup = null;
    let isLoaded = false;
    let queuedFeatures = null;
    let clusterIndex = null;
    let lastRenderKey = null;
    let mapPanTriggered = false;
    // Post-filter, PRE-pagination items. afterRender receives the paginated
    // subset (current page only) — capturing here gives the full filtered set
    // so every matching marker lands on the map, not just the current page.
    let filteredItems = [];
    let initialRenderDone = false;
    // Signature of the last rendered feature set; used to no-op render() when
    // the same items come through (e.g., pagination click, unchanged filter).
    let lastRenderSignature = null;
    // CMS Load streams pages in. We render markers from whatever's loaded so far
    // (markers fill in as pages arrive) rather than blocking on the full set —
    // the visible cards and the map both show early. `finalizingCmsLoad` marks
    // the single re-render fired once all pages are in, so afterRender knows not
    // to refit the camera for it (a "data finished loading" event isn't a user
    // intent to move the view).
    const pendingCmsLoad = fsListInstance.loadingPaginatedItems;
    let cmsLoadDone = !pendingCmsLoad;
    let finalizingCmsLoad = false;
    pendingCmsLoad?.finally(()=>{
        cmsLoadDone = true;
        if (!mapPanTriggered) {
            finalizingCmsLoad = true;
            fsListInstance.triggerHook("filter");
        }
    });
    let userLocationMarker = null;
    function setUserLocationMarker(loc) {
        if (userLocationMarker) {
            userLocationMarker.setLngLat(loc);
            return;
        }
        userLocationMarker = new mapboxgl.Marker({
            element: cloneTemplate(userLocationTemplateEl),
            anchor: "center"
        }).setLngLat(loc).addTo(map);
    }
    function showUserLocation(loc) {
        if (!loc || !isLoaded) return;
        setUserLocationMarker(loc);
        map.flyTo({
            center: loc,
            zoom: USER_LOCATION_ZOOM,
            duration: FIT_BOUNDS_CONFIG.duration,
            padding: sheetPadding()
        });
    }
    // Returns true when it actually started a fly-to, false when there's no map
    // or no selected city coords — callers fall back to fit-to-features.
    function flyToCity() {
        if (!isLoaded) return false;
        const loc = getSelectedCityCoords();
        if (!loc) return false;
        map.flyTo({
            center: loc,
            zoom: CITY_ZOOM,
            duration: FIT_BOUNDS_CONFIG.duration,
            padding: sheetPadding()
        });
        return true;
    }
    function clearMarkers() {
        clusterMarkers.forEach((e)=>e.marker.remove());
        clusterMarkers.clear();
        pointMarkers.forEach((e)=>e.marker.remove());
        pointMarkers.clear();
    }
    function pointKey(feature) {
        return feature.id || feature.coordinates.join(",");
    }
    function closePopup() {
        if (activePopup) {
            activePopup.remove();
            activePopup = null;
        }
    }
    function openPopup(feature) {
        closePopup();
        const content = buildPopupContent(feature);
        if (!content) {
            console.warn(`[studios-map] No ${S.popup} in item${feature.id ? ` (id="${feature.id}")` : ""} \u{2014} skipping popup`);
            return;
        }
        activePopup = new mapboxgl.Popup({
            className: POPUP_CLASS,
            closeButton: true,
            closeOnClick: true,
            maxWidth: "none"
        }).setLngLat(feature.coordinates).setDOMContent(content).addTo(map);
        // Mapbox's own close paths (X button, closeOnClick, ESC) don't route through
        // closePopup — listen for 'close' so the ref stays in sync.
        activePopup.on("close", ()=>{
            activePopup = null;
        });
    }
    function attachMarker(el, coords, onClick) {
        const marker = new mapboxgl.Marker({
            element: el,
            anchor: "center"
        }).setLngLat(coords).addTo(map);
        // Opacity-only fade; animating `transform` would fight Mapbox's per-frame
        // marker positioning during pan/zoom and cause drag lag.
        el.animate([
            {
                opacity: 0
            },
            {
                opacity: 1
            }
        ], {
            duration: MARKER_FADE_DURATION,
            easing: "ease-out"
        });
        el.addEventListener("click", (e)=>{
            e.stopPropagation();
            onClick();
        });
        return marker;
    }
    function addPointMarker(feature) {
        const entry = {
            feature
        };
        entry.marker = attachMarker(buildMarkerElement(feature), feature.coordinates, ()=>{
            openPopup(entry.feature);
            map.flyTo({
                center: entry.feature.coordinates,
                speed: 0.6,
                padding: sheetPadding()
            });
        });
        pointMarkers.set(pointKey(feature), entry);
    }
    function addClusterMarker(cluster) {
        const entry = {
            clusterId: cluster.properties.cluster_id,
            coords: cluster.geometry.coordinates
        };
        entry.marker = attachMarker(buildClusterElement(clusterTemplateEl, cluster.properties.point_count), entry.coords, ()=>{
            const expansionZoom = clusterIndex.getClusterExpansionZoom(entry.clusterId);
            map.flyTo({
                center: entry.coords,
                zoom: expansionZoom + CLUSTER_EXPANSION_PADDING,
                duration: FIT_BOUNDS_CONFIG.duration,
                padding: sheetPadding()
            });
        });
        clusterMarkers.set(entry.clusterId, entry);
    }
    function rebuildIndex(features) {
        // Supercluster.load() throws on an empty array ("Unexpected numItems value: 0"),
        // which rejects Finsweet's filter promise and stops subsequent filter events
        // from firing — including the one that fires when the user clears the input.
        if (features.length === 0) clusterIndex = null;
        else clusterIndex = new Supercluster(CLUSTER_CONFIG).load(features.map((f)=>({
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: f.coordinates
                },
                properties: {
                    feature: f
                }
            })));
        lastRenderKey = null;
        // cluster_ids change with each new index — drop reused clusters so the
        // next renderClusters creates fresh ones instead of wiring to stale ids.
        clearMarkers();
    }
    // Render bbox = the geographic rect of the strip ABOVE the sheet, not the
    // full canvas. This makes markers/clusters appear and disappear as the
    // sheet covers/uncovers map area. Falls back to full canvas bounds when
    // the sheet is absent, hasn't upgraded yet, or covers the whole map.
    // Uses unproject (not lat ratio) so it stays correct on globe / Mercator
    // at any latitude.
    function getRenderBbox() {
        const cov = sheetCoverage();
        const container = map.getContainer();
        const w = container.clientWidth;
        const h = container.clientHeight;
        const visibleH = h - cov;
        if (cov <= 0 || visibleH < 50) return map.getBounds().toArray().flat();
        const nw = map.unproject([
            0,
            0
        ]);
        const ne = map.unproject([
            w,
            0
        ]);
        const sw = map.unproject([
            0,
            visibleH
        ]);
        const se = map.unproject([
            w,
            visibleH
        ]);
        return [
            Math.min(nw.lng, sw.lng),
            Math.min(sw.lat, se.lat),
            Math.max(ne.lng, se.lng),
            Math.max(nw.lat, ne.lat)
        ];
    }
    function renderClusters() {
        if (!isLoaded || !clusterIndex) return;
        const bbox = getRenderBbox();
        const zoom = Math.floor(map.getZoom());
        // Round bbox to 4 decimals (~11m) so float jitter from programmatic
        // camera ops doesn't bust the cache.
        const renderKey = `${bbox.map((n)=>n.toFixed(4)).join(",")}|${zoom}`;
        if (renderKey === lastRenderKey) return;
        lastRenderKey = renderKey;
        const seenClusters = new Set();
        const seenPoints = new Set();
        clusterIndex.getClusters(bbox, zoom).forEach((item)=>{
            if (item.properties.cluster) {
                const id = item.properties.cluster_id;
                seenClusters.add(id);
                const existing = clusterMarkers.get(id);
                if (existing) {
                    existing.marker.setLngLat(item.geometry.coordinates);
                    existing.coords = item.geometry.coordinates;
                    applyClusterMeta(existing.marker.getElement(), item.properties.point_count, S.count);
                } else addClusterMarker(item);
            } else {
                const feature = item.properties.feature;
                const id = pointKey(feature);
                seenPoints.add(id);
                const existing = pointMarkers.get(id);
                if (existing) {
                    existing.marker.setLngLat(feature.coordinates);
                    existing.feature = feature;
                } else addPointMarker(feature);
            }
        });
        clusterMarkers.forEach((entry, id)=>{
            if (seenClusters.has(id)) return;
            entry.marker.remove();
            clusterMarkers.delete(id);
        });
        pointMarkers.forEach((entry, id)=>{
            if (seenPoints.has(id)) return;
            entry.marker.remove();
            pointMarkers.delete(id);
        });
    }
    // `fit` controls whether the camera reframes to the feature set. We fit on
    // the initial render (always — frames the first markers) and on user-driven
    // filter changes, but NOT while CMS pages are still streaming in, so the
    // camera doesn't lurch on every page that lands.
    function render(features, { fit = true } = {}) {
        if (!isLoaded) {
            queuedFeatures = features;
            return;
        }
        // Skip no-op renders (pagination, sort with same items) — prevents
        // wasted fitBounds camera jumps and supercluster rebuilds.
        const signature = features.map(pointKey).join("|");
        if (signature !== lastRenderSignature) {
            lastRenderSignature = signature;
            closePopup();
            rebuildIndex(features);
            renderClusters();
            // On a user-driven refit (not the initial render) that lands on an empty
            // filter state — i.e. the user just cleared all filters — return to the
            // initial city view instead of zooming out to frame every studio. Falls
            // back to fit-to-features when there's no selected city to fly to.
            const returnedToCity = fit && initialRenderDone && !hasActiveFilters() && flyToCity();
            if (!returnedToCity && (fit || !initialRenderDone)) fitToFeatures(map, features, sheetCoverage());
        }
        // First successful render: fly to the selected city. If the active city
        // has no coords (or city.js hasn't booted yet), the fit-to-all view we
        // just applied stays in place — the city.onChange subscription below
        // will re-fly the map once the city activates.
        //
        // Exception: when a `?city=…` URL filter is active, the studios
        // list is already pre-filtered to that selection — the fitToFeatures
        // call above frames it correctly. Skip flyToCity in that case so the
        // visitor's saved city doesn't yank the camera off the URL-filtered set.
        if (!initialRenderDone) {
            initialRenderDone = true;
            const urlCities = /** @type {any} */ window.bruce?.city?.urlSelection?.() ?? [];
            if (urlCities.length === 0) flyToCity();
        }
    }
    // Lazily build the map: load the CDN libs, create the map, wire its events,
    // then flush whatever features have queued up while it was absent. Runs at
    // most once per instance; safe to call from the observer or any handler.
    let mapInitStarted = false;
    function ensureMap() {
        if (mapInitStarted) return;
        mapInitStarted = true;
        loadMapboxLibs().then(()=>{
            map = createMap(mapTargetEl);
            map.addControl(new mapboxgl.AttributionControl({
                compact: true
            }));
            map.on("load", ()=>{
                isLoaded = true;
                if (queuedFeatures !== null) {
                    const features = queuedFeatures;
                    queuedFeatures = null;
                    render(features);
                }
            });
            // Keep markers / clusters up to date as the user pans and zooms. This
            // is purely visual — the list is NOT auto-refiltered to viewport. See
            // the search-area button below for explicit bounds refilter.
            //
            // `originalEvent` is only present on USER-initiated moves (pan, pinch,
            // wheel). Programmatic moves (flyTo, fitBounds) don't carry it — we
            // only mark the button "dirty" when the user actually moved the map.
            map.on("moveend", (e)=>{
                renderClusters();
                if (e.originalEvent) setSearchAreaDirty(true);
            });
        }).catch((err)=>console.error(err));
    }
    // Build the map the first time its container nears the viewport. Deferring
    // to idle keeps mapbox-gl's parse/eval out of the post-FCP TBT window. The
    // 200px rootMargin warms it just before it's actually scrolled into view.
    const mapObserver = new IntersectionObserver((entries)=>{
        if (!entries.some((entry)=>entry.isIntersecting)) return;
        mapObserver.disconnect();
        (0, _mapboxJs.whenIdle)(ensureMap);
    }, {
        rootMargin: "200px"
    });
    mapObserver.observe(mapTargetEl);
    // City switch → re-center the map. Gated on initialRenderDone so an
    // activation that lands between map.load and the first render doesn't
    // start a flyTo that fitToFeatures will immediately interrupt — the
    // initial-render block owns that case. After the first render, every
    // slug change re-flies here.
    /** @type {any} */ window.bruce?.city?.onChange?.(()=>{
        if (initialRenderDone) flyToCity();
    });
    // Locate buttons → request a fresh location on each click (bypasses the
    // module-level cache so repeat clicks re-prompt or refresh). `data-state` is
    // mirrored across every copy so the desktop and mobile buttons agree.
    const setLocateState = (state)=>locateButtonEls.forEach((el)=>el.dataset.state = state);
    locateButtonEls.forEach((btn)=>{
        btn.addEventListener("click", async ()=>{
            setLocateState("locating");
            const loc = await (0, _locationJs.requestUserLocation)();
            setLocateState(loc ? "success" : "error");
            if (loc) showUserLocation(loc);
        });
    });
    // Search-this-area buttons → explicit bounds refilter. The list ONLY narrows
    // to the visible map area when the user presses this. Pan/zoom alone don't
    // change the list — matches the Airbnb/Booking pattern and avoids the
    // "my list keeps jumping" surprise.
    searchAreaButtonEls.forEach((btn)=>{
        btn.addEventListener("click", ()=>{
            if (!isLoaded) return;
            // `mapPanTriggered` doubles here as "this filter pass was triggered by
            // the map, not by a user filter/category change". The filter hook uses
            // it to decide whether to apply the bounds filter; `afterRender` uses
            // it to skip the full marker rebuild (markers haven't changed, just
            // which items the list shows).
            mapPanTriggered = true;
            fsListInstance.triggerHook("filter");
            // List now reflects the current map view → clean state, buttons hide.
            setSearchAreaDirty(false);
        });
    });
    // Bounds-filters items when moveend triggered this pass; otherwise passes
    // through. Captures the output as `filteredItems` — afterRender receives the
    // post-pagination slice, which would miss everything beyond the current page.
    fsListInstance.addHook("filter", (items)=>{
        let result = items;
        // Only narrow to map bounds when the user explicitly requested it AND
        // there's enough visible map to browse (skip when sheet is fully
        // expanded — showing "0 in view" would be jarring).
        if (isLoaded && mapPanTriggered && getCanvasSize(map, 200)) {
            const bounds = map.getBounds();
            result = items.filter((item)=>{
                const one = extractOne(item.element);
                return !one || bounds.contains(one.coordinates);
            });
        }
        filteredItems = result;
        scheduleFilteringTransition();
        return result;
    });
    // `afterRender` fires after the full pipeline resolves on every change
    // (filter, sort, pagination, load-more, initial render). On map-driven
    // updates we skip the map side — FS already re-rendered the list subset,
    // and `renderClusters` already ran on moveend. On FS-driven updates we
    // do the full rebuild + refit so the map follows the user's intent.
    fsListInstance.addHook("afterRender", (items)=>{
        // Count display reflects the post-filter, pre-pagination set; update
        // before any early return so map-driven and in-progress-load renders
        // still keep the count in sync.
        updateCountDisplay(component, filteredItems.length);
        refreshSearchbarCounts();
        // Reveal the (server-rendered, already-in-DOM) cards on the first render
        // instead of waiting for the full 44-page CMS stream + map init. This is
        // the main LCP win: the visible list no longer hides behind background
        // loading. `render()` self-queues until the map exists, so calling it here
        // before the map is built is safe.
        setState("ready");
        if (mapPanTriggered) {
            mapPanTriggered = false;
            return items;
        }
        // Render markers from the items loaded so far so the map fills in as pages
        // stream. Fit the camera only once fully loaded AND on a real user filter
        // change — never on a streaming page or on the load-finished re-render
        // (finalizingCmsLoad), so the view stays put while data arrives.
        render(extractFeatures(filteredItems.map((i)=>i.element)), {
            fit: cmsLoadDone && initialRenderDone && !finalizingCmsLoad
        });
        finalizingCmsLoad = false;
        return items;
    });
}
// ── Searchbar filter counts ──────────────────────────────────
// The Finsweet filters form holds every filter input on this page. Reflect its
// active-filter count badges via the shared util (which dedupes the duplicated
// modal/nav/toolbar copies of each option). The `afterRender` hook above drives
// every refresh — user toggles re-render, and so do Finsweet's programmatic
// changes (URL restore on load, "Reset all", chip removal) — so no separate
// `change` listener is needed. A baseline runs at boot, and submit is blocked so
// Enter in the search field doesn't reload the page out from under Finsweet.
// (Off the search page, `studios-search-redirect.js` owns its own form.)
const SEARCH_FORM_SELECTOR = 'form[fs-list-element="filters"]';
function refreshSearchbarCounts() {
    document.querySelectorAll(SEARCH_FORM_SELECTOR).forEach((form)=>(0, _studiosFilterCountJs.updateFilterCounts)(/** @type {HTMLFormElement} */ form));
}
// True when any filter is currently engaged: a checked option in any group, or
// a non-empty free-text query. Read straight from the form DOM (same source as
// the count badges) so it reflects post-clear state when called from
// afterRender. Used to send the camera home to the selected city when the user
// clears everything rather than fitting the whole unfiltered set.
function hasActiveFilters() {
    for (const form of document.querySelectorAll(SEARCH_FORM_SELECTOR))for (const el of form.querySelectorAll("input")){
        const input = /** @type {HTMLInputElement} */ el;
        if (!input.name) continue;
        if (input.name === "q") {
            if (input.value.trim()) return true;
        } else if (input.checked) return true;
    }
    return false;
}
function setupSearchbarForms() {
    document.querySelectorAll(SEARCH_FORM_SELECTOR).forEach((el)=>{
        const form = /** @type {HTMLFormElement} */ el;
        if (form.dataset.searchFiltersInit) return;
        form.dataset.searchFiltersInit = "true";
        form.addEventListener("submit", (event)=>event.preventDefault());
        // Reflect filter state instantly on interaction, ahead of Finsweet's
        // 200ms-debounced afterRender. afterRender stays the authoritative refresh
        // for programmatic changes (URL restore on load, "Reset all", chip
        // removal); this just removes the felt lag on a direct user toggle.
        // updateFilterCounts is pure + idempotent, so the double-run is harmless.
        form.addEventListener("change", ()=>(0, _studiosFilterCountJs.updateFilterCounts)(form));
        (0, _studiosFilterCountJs.updateFilterCounts)(form);
    });
}
// ── Apply inbound deep-link filters ──────────────────────────
// Pages elsewhere link in with clean params (studios-search-redirect.js):
// `/s?q=boxing&city=Stockholm&category=Pilates`. We replay each as exactly ONE
// real checkbox click and let Finsweet own all state from there.
//
// Why one click and nothing else: the filter form renders each option as 3
// duplicate copies (modal / nav / toolbar) that Finsweet does NOT keep in
// sync (a real click checks only the clicked copy), and `fs-list-debounce=200`
// makes it re-read the DOM after a delay. Any approach that ends up with more
// than one checked copy — faking `.checked`, or the `filters` model API which
// reflects into all 3 copies — gets re-read as the value N times ("BLACK |
// BLACK | BLACK") and breaks toggling. One genuine click matches native
// behaviour exactly: one tag (it's an `interacted` event), one condition,
// clean toggle. Prefer the copy in the visible toolbar dropdowns
// (`[data-search-group]`, where the count badges live) so the selection shows
// where the user actually looks. Runs once.
//
// NOTE: because Finsweet never syncs the 3 duplicate UIs, only the toolbar
// dropdown reflects the selection — the modal/nav copies stay blank, exactly
// as they would for a manual click. Fully syncing them needs the duplicate
// filter UIs collapsed into one instance (a markup change), not more JS.
// PerformanceNavigationTiming.type for this page load, or "navigate" where the
// API is unavailable (treated as a fresh inbound visit → safe to replay).
function getNavigationType() {
    const nav = performance.getEntriesByType?.("navigation")?.[0];
    return /** @type {any} */ nav?.type ?? "navigate";
}
let urlFiltersApplied = false;
function applyUrlDeepLinkFilters() {
    if (urlFiltersApplied) return;
    // On back/forward Finsweet restores its own filter state from the URL it
    // took over — replaying our params on top double-checks the duplicate
    // copies and desyncs the model (see studios-deep-link.js). Leave it to FS,
    // and seal the gate so this decision isn't re-evaluated on every later
    // Finsweet callback for the rest of the page's life.
    if (!(0, _studiosDeepLinkJs.shouldApplyDeepLinkFilters)(getNavigationType())) {
        urlFiltersApplied = true;
        return;
    }
    const form = document.querySelector(SEARCH_FORM_SELECTOR);
    if (!form) return;
    const params = new URLSearchParams(location.search);
    // fieldKey → set of values (repeated keys = multi-select within a field).
    const byField = new Map();
    for (const [key, value] of params){
        if (key === "q") continue;
        const set = byField.get(key) ?? new Set();
        set.add(value);
        byField.set(key, set);
    }
    const query = (params.get("q") ?? "").trim();
    if (byField.size === 0 && !query) return;
    urlFiltersApplied = true;
    requestAnimationFrame(()=>{
        const inputs = /** @type {HTMLInputElement[]} */ [
            ...form.querySelectorAll("input[fs-list-field][fs-list-value]")
        ];
        for (const [fieldKey, values] of byField)for (const value of values){
            const copies = inputs.filter((el)=>el.getAttribute("fs-list-field") === fieldKey && el.getAttribute("fs-list-value") === value);
            // Skip the click if ANY copy is already checked — clicking a second
            // copy registers the value twice and breaks toggling. Inspect every
            // copy, not just the toolbar one, since the copies are never synced.
            const idx = (0, _studiosDeepLinkJs.pickDeepLinkClickIndex)(copies.map((el)=>({
                    checked: el.checked,
                    inSearchGroup: !!el.closest("[data-search-group]")
                })));
            if (idx !== -1) copies[idx].click();
        }
        // Free-text query → the search input, which Finsweet watches for `input`.
        if (query) {
            const search = /** @type {HTMLInputElement | null} */ form.querySelector('input[name="q"]');
            if (search) {
                search.value = query;
                search.dispatchEvent(new Event("input", {
                    bubbles: true
                }));
            }
        }
    });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setupSearchbarForms, {
    once: true
});
else setupSearchbarForms();
window.FinsweetAttributes ||= [];
window.FinsweetAttributes.push([
    "list",
    (listInstances)=>{
        const studioInstances = listInstances.filter((instance)=>instance.instance === FS_LIST_INSTANCE_KEY);
        if (studioInstances.length === 0) return;
        // mapbox-gl is loaded lazily per instance (see loadMapboxLibs) the first
        // time the map scrolls into view — nothing to await here.
        studioInstances.forEach((instance)=>{
            if (initializedInstances.has(instance)) return;
            initializedInstances.add(instance);
            setupStudiosInstance(instance);
        });
        // Hooks are wired now, so applying inbound deep-link filters re-renders
        // through them (map + count badges follow).
        applyUrlDeepLinkFilters();
    }
]);

},{"./location.js":"WOwQU","./studios-filter-count.js":"km8B3","./studios-deep-link.js":"l1Yag","./mapbox.js":"enNxR","./studios-city-filter.js":"aOimG"}],"WOwQU":[function(require,module,exports,__globalThis) {
/**
 * Location
 *
 * Browser geolocation, centralized so multiple modules can share the
 * permission prompt and session cache. Pure browser-API wrapper — no
 * dependency on Mapbox or any other library.
 *
 * ── Public API ───────────────────────────────────────────────
 *   window.bruce.location.requestUserLocation()
 *     Always issues a fresh geolocation request. Resolves [lng, lat]
 *     on success, null on denial / timeout / unavailable. Updates the
 *     last-known cache on success.
 *
 *   window.bruce.location.getInitialUserLocation()
 *     Shared session-scoped promise. First call kicks off the request;
 *     subsequent calls reuse the same in-flight or settled promise.
 *     Use this to coordinate boot-time location reads across modules
 *     without double-prompting.
 *
 *   window.bruce.location.getLastKnown()
 *     Synchronous accessor. Returns the most recent successful coord,
 *     or null. Never triggers a prompt, never throws. A later failed
 *     request does NOT wipe a previously-cached success.
 *
 * Each function is also exported as an ES module named export.
 */ var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
// Browser geolocation → [lng, lat] or null on denial / timeout / unavailable.
// External timeout guards against stuck permission prompts (the native
// `timeout` option only counts time after permission is granted).
parcelHelpers.export(exports, "requestUserLocation", ()=>requestUserLocation);
// Shared across modules so the permission prompt only fires once per session.
parcelHelpers.export(exports, "getInitialUserLocation", ()=>getInitialUserLocation);
parcelHelpers.export(exports, "getLastKnown", ()=>getLastKnown);
const USER_LOCATION_TIMEOUT = 8000;
/** @type {[number, number] | null} */ let lastKnown = null;
/** @type {Promise<[number, number] | null> | null} */ let initialLocationPromise = null;
function requestUserLocation() {
    return new Promise((resolve)=>{
        if (!navigator.geolocation) return resolve(null);
        let settled = false;
        const finish = (result)=>{
            if (settled) return;
            settled = true;
            if (result) lastKnown = result;
            resolve(result);
        };
        const timer = setTimeout(()=>finish(null), USER_LOCATION_TIMEOUT);
        navigator.geolocation.getCurrentPosition((pos)=>{
            clearTimeout(timer);
            finish([
                pos.coords.longitude,
                pos.coords.latitude
            ]);
        }, ()=>{
            clearTimeout(timer);
            finish(null);
        }, {
            timeout: USER_LOCATION_TIMEOUT,
            maximumAge: 60000,
            enableHighAccuracy: false
        });
    });
}
function getInitialUserLocation() {
    if (!initialLocationPromise) initialLocationPromise = requestUserLocation();
    return initialLocationPromise;
}
function getLastKnown() {
    return lastKnown;
}
/** @type {any} */ window.bruce ||= {};
/** @type {any} */ window.bruce.location = {
    requestUserLocation,
    getInitialUserLocation,
    getLastKnown
};

},{"@parcel/transformer-js/src/esmodule-helpers.js":"4PAvJ"}],"4PAvJ":[function(require,module,exports,__globalThis) {
exports.interopDefault = function(a) {
    return a && a.__esModule ? a : {
        default: a
    };
};
exports.defineInteropFlag = function(a) {
    Object.defineProperty(a, '__esModule', {
        value: true
    });
};
exports.exportAll = function(source, dest) {
    Object.keys(source).forEach(function(key) {
        if (key === 'default' || key === '__esModule' || Object.prototype.hasOwnProperty.call(dest, key)) return;
        Object.defineProperty(dest, key, {
            enumerable: true,
            get: function() {
                return source[key];
            }
        });
    });
    return dest;
};
exports.export = function(dest, destName, get) {
    Object.defineProperty(dest, destName, {
        enumerable: true,
        get: get
    });
};

},{}],"km8B3":[function(require,module,exports,__globalThis) {
/**
 * Studios Filter Count
 *
 * Shared count/state reflection for the studios searchbar, used by both the
 * off-page redirect searchbar (`studios-search-redirect.js`) and the live
 * search page, where `studios.js` drives it from its Finsweet `afterRender` hook.
 *
 * Reflects the current filter selection of a form into the DOM so Webflow can
 * style "has active filters" UI (e.g. a count badge) without custom JS:
 *
 *   - The form gets `data-has-filters="true|false"` and `data-filter-count`
 *     for the TOTAL number of checked filter options.
 *   - `[data-search-group="city_equal"]` elements get the same two attributes
 *     scoped to that one group — style each dropdown toggle independently.
 *   - `[data-search-count]` elements get their textContent set to the count:
 *     the total when the attribute is empty, or a group's count when it names
 *     one (`data-search-count="city_equal"`).
 *
 * Pure, no auto-boot — consumers decide when to call updateFilterCounts and on
 * which events (change, init, Finsweet afterRender).
 */ var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
/**
 * Tally checked filter inputs by group. Pure — takes the list of `name`s of
 * the checked inputs (in DOM order) and returns the total plus a per-name count.
 *
 * @param {string[]} names
 * @returns {{ total: number, byGroup: Map<string, number> }}
 */ parcelHelpers.export(exports, "tallyCheckedFilters", ()=>tallyCheckedFilters);
/**
 * Reflect a form's current filter selection into the DOM hooks above.
 * @param {HTMLFormElement} form
 */ parcelHelpers.export(exports, "updateFilterCounts", ()=>updateFilterCounts);
const QUERY_FIELD = "q";
const COUNT_SELECTOR = "[data-search-count]";
const GROUP_STATE_SELECTOR = "[data-search-group]";
function tallyCheckedFilters(names) {
    const byGroup = new Map();
    for (const name of names)byGroup.set(name, (byGroup.get(name) ?? 0) + 1);
    return {
        total: names.length,
        byGroup
    };
}
function updateFilterCounts(form) {
    // The same filter option can appear several times inside one form (e.g. the
    // search page renders the filters in a modal, the nav searchbar, AND the
    // toolbar, all kept in sync by Finsweet). Dedupe by name+value so a value
    // selected across those copies counts once, not once per copy.
    const seen = new Set();
    const names = [];
    for (const el of form.querySelectorAll("input:checked")){
        const input = /** @type {HTMLInputElement} */ el;
        if (!input.name || input.name === QUERY_FIELD) continue;
        const key = `${input.name} ${input.value}`;
        if (seen.has(key)) continue;
        seen.add(key);
        names.push(input.name);
    }
    const { total, byGroup } = tallyCheckedFilters(names);
    form.dataset.hasFilters = total > 0 ? "true" : "false";
    form.dataset.filterCount = String(total);
    form.querySelectorAll(GROUP_STATE_SELECTOR).forEach((el)=>{
        const group = el.getAttribute("data-search-group") || "";
        const count = byGroup.get(group) ?? 0;
        const node = /** @type {HTMLElement} */ el;
        node.dataset.hasFilters = count > 0 ? "true" : "false";
        node.dataset.filterCount = String(count);
    });
    form.querySelectorAll(COUNT_SELECTOR).forEach((el)=>{
        const group = el.getAttribute("data-search-count");
        el.textContent = String(group ? byGroup.get(group) ?? 0 : total);
    });
}

},{"@parcel/transformer-js/src/esmodule-helpers.js":"4PAvJ"}],"l1Yag":[function(require,module,exports,__globalThis) {
/**
 * Pure decision helpers for the inbound deep-link filter replay in studios.js.
 *
 * Kept framework-free (no DOM, no globals) so the "should we replay at all, and
 * which duplicate copy do we click?" rules live in one unit-testable place —
 * mirroring how `tallyCheckedFilters` lives in studios-filter-count.js. The DOM
 * wiring stays in studios.js `applyUrlDeepLinkFilters`.
 */ /**
 * Whether the inbound deep-link replay should run for this navigation type.
 *
 * On a back/forward navigation Finsweet restores its OWN filter state from the
 * URL it took over after the first apply. Replaying our URL params on top then
 * clicks a duplicate copy of an option Finsweet already checked — and two
 * checked copies of the same value make Finsweet read it twice, breaking
 * toggling (the "BLACK | BLACK" desync). The race between Finsweet's restore
 * and our replay is what made filtering intermittently wrong after going
 * back/forward. So only replay on a genuine inbound navigation or an explicit
 * reload; let Finsweet own restoration on back/forward.
 *
 * @param {string} navigationType - PerformanceNavigationTiming.type
 *   ("navigate" | "reload" | "back_forward" | "prerender").
 * @returns {boolean}
 */ var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
parcelHelpers.export(exports, "shouldApplyDeepLinkFilters", ()=>shouldApplyDeepLinkFilters);
/**
 * Given the duplicate copies of ONE filter option (the modal / nav / toolbar
 * triplet Finsweet never syncs), return the index to click, or -1 to leave
 * them alone.
 *
 * Skips entirely when ANY copy is already checked: the filter model already
 * holds that condition (the user, Finsweet's URL restore, or the browser's
 * form restoration checked one), so clicking another copy would register the
 * value a second time and desync. Otherwise prefers the copy inside the
 * visible toolbar dropdown (`inSearchGroup`) so the selection shows where the
 * user looks, falling back to the first copy.
 *
 * @param {{ checked: boolean, inSearchGroup: boolean }[]} copies
 * @returns {number} index into `copies`, or -1
 */ parcelHelpers.export(exports, "pickDeepLinkClickIndex", ()=>pickDeepLinkClickIndex);
function shouldApplyDeepLinkFilters(navigationType) {
    return navigationType !== "back_forward";
}
function pickDeepLinkClickIndex(copies) {
    if (copies.length === 0) return -1;
    if (copies.some((c)=>c.checked)) return -1;
    const grouped = copies.findIndex((c)=>c.inSearchGroup);
    return grouped === -1 ? 0 : grouped;
}

},{"@parcel/transformer-js/src/esmodule-helpers.js":"4PAvJ"}],"enNxR":[function(require,module,exports,__globalThis) {
// Shared Mapbox GL loader — used by both studios.js (list/map page) and
// studio.js (single studio template page). Mapbox GL is loaded LAZILY from the
// CDN on first call; it must NOT be added as a blocking <script> in the Webflow
// <head>, or the ~460 KB + eval lands back on the critical path.
//
// Supercluster is intentionally NOT loaded here — only the list page clusters,
// so it loads supercluster separately alongside loadMapboxGl().
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
parcelHelpers.export(exports, "MAPBOX_ACCESS_TOKEN", ()=>MAPBOX_ACCESS_TOKEN);
parcelHelpers.export(exports, "MAPBOX_STYLE", ()=>MAPBOX_STYLE);
parcelHelpers.export(exports, "MAPBOX_JS_URL", ()=>MAPBOX_JS_URL);
parcelHelpers.export(exports, "MAPBOX_CSS_URL", ()=>MAPBOX_CSS_URL);
// Inject a <script> once and resolve when it has executed. Idempotent across
// instances and re-entrant calls (multiple maps share one load).
parcelHelpers.export(exports, "loadScriptOnce", ()=>loadScriptOnce);
parcelHelpers.export(exports, "loadStyleOnce", ()=>loadStyleOnce);
parcelHelpers.export(exports, "loadMapboxGl", ()=>loadMapboxGl);
// Defer non-urgent work to idle time (keeps the heavy Mapbox eval out of the
// post-FCP TBT window), falling back to a short timeout where unsupported.
parcelHelpers.export(exports, "whenIdle", ()=>whenIdle);
const MAPBOX_ACCESS_TOKEN = "pk.eyJ1IjoibmlrbGFzaGFuc3NvbiIsImEiOiJjbWxleHI0MngxaHU3M2dzOWZrMXJpMjJlIn0.yvXc8nLFEuUocjlwqNZiJQ";
const MAPBOX_STYLE = "mapbox://styles/niklashansson/cmlextxil004n01r3d9gq7uzj";
const MAPBOX_JS_URL = "https://api.mapbox.com/mapbox-gl-js/v3.21.0/mapbox-gl.js";
const MAPBOX_CSS_URL = "https://api.mapbox.com/mapbox-gl-js/v3.21.0/mapbox-gl.css";
function loadScriptOnce(src) {
    return new Promise((resolve, reject)=>{
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            if (existing.dataset.loaded === "true") return resolve();
            existing.addEventListener("load", ()=>resolve(), {
                once: true
            });
            existing.addEventListener("error", reject, {
                once: true
            });
            return;
        }
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.addEventListener("load", ()=>{
            script.dataset.loaded = "true";
            resolve();
        }, {
            once: true
        });
        script.addEventListener("error", reject, {
            once: true
        });
        document.head.appendChild(script);
    });
}
function loadStyleOnce(href) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
}
// Loads mapbox-gl (+ its CSS) on first call and caches the promise so every
// caller awaits the same single load. Sets the access token once ready and
// resolves with the global `mapboxgl`.
let mapboxGlPromise = null;
function loadMapboxGl() {
    if (mapboxGlPromise) return mapboxGlPromise;
    mapboxGlPromise = (async ()=>{
        loadStyleOnce(MAPBOX_CSS_URL);
        if (!window.mapboxgl) await loadScriptOnce(MAPBOX_JS_URL);
        const mapboxgl = window.mapboxgl;
        if (!mapboxgl) throw new Error("[mapbox] mapbox-gl failed to load from the CDN.");
        mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
        return mapboxgl;
    })();
    return mapboxGlPromise;
}
function whenIdle(cb) {
    if (typeof requestIdleCallback === "function") requestIdleCallback(cb, {
        timeout: 2000
    });
    else setTimeout(cb, 200);
}

},{"@parcel/transformer-js/src/esmodule-helpers.js":"4PAvJ"}],"aOimG":[function(require,module,exports,__globalThis) {
/**
 * Studios Heading City Picker (search page only)
 *
 * Replaces the old toolbar "Location" filter with a single-select city picker
 * inline in the result-count heading ("Over N studios in [City ▾]"). The
 * picker is the ONLY city control on the page and drives a single hidden
 * Finsweet `city` group, so the never-synced duplicate filter copies are gone.
 *
 * bruce.city is the source of truth for CONTEXT (map home + placeholders +
 * persistence). This module is a thin one-way bridge: a picker selection ->
 * bruce.city.set (context) + a hidden Finsweet input click (narrowing) -> the
 * count + map follow studios.js's afterRender pipeline. The heading reflects
 * the FILTER selection only and never reacts to context changes elsewhere.
 *
 * Auto-boot is guarded against a missing `document` so the module stays
 * importable in Node.
 */ var _studiosCitySelectJs = require("./studios-city-select.js");
var _studiosDeepLinkJs = require("./studios-deep-link.js");
var _locationJs = require("./location.js");
const FS_LIST_INSTANCE_KEY = "studios";
const FILTERS_FORM = 'form[fs-list-element="filters"]';
const PICKER = "[data-studios-city-picker]";
const LABEL = "[data-studios-city-label]";
const OPTION = "[data-studios-city-option]";
const ALL_OPTION = '[data-studios-city-option="all"]';
const CITY_INPUT = 'input[fs-list-field="city"]';
const ACTIVE_ATTR = "data-studios-city-active";
const ALL = "all";
// PerformanceNavigationTiming.type for this load, or "navigate" where the API
// is unavailable (treated as a fresh inbound visit -> safe to engage).
function getNavigationType() {
    const nav = performance.getEntriesByType?.("navigation")?.[0];
    return /** @type {any} */ nav?.type ?? "navigate";
}
const cityApi = ()=>/** @type {any} */ window.bruce?.city;
// slug -> the fs-list-value of the hidden inputs (the CMS city name).
function cityName(slug) {
    return cityApi()?.all?.().find((c)=>c.slug === slug)?.name ?? null;
}
// fs-list-value of the currently-checked hidden city input, or null.
function checkedCityValue(form) {
    const checked = form.querySelector(`${CITY_INPUT}:checked`);
    return checked ? checked.getAttribute("fs-list-value") : null;
}
// Move the hidden single-select city group to `slug` (or null = all). One
// genuine click per change so we never leave two copies checked.
function syncHiddenFilter(form, slug) {
    const targetValue = slug ? cityName(slug) : null;
    const currentValue = checkedCityValue(form);
    for (const value of (0, _studiosCitySelectJs.planCityFilterClicks)({
        targetValue,
        currentValue
    })){
        const input = form.querySelector(`${CITY_INPUT}[fs-list-value="${CSS.escape(value)}"]`);
        if (input) /** @type {HTMLElement} */ input.click();
    }
}
function allLabel(picker) {
    return picker.querySelector(ALL_OPTION)?.textContent?.trim() || "All cities";
}
function updateLabel(picker, text) {
    const label = picker.querySelector(LABEL);
    if (label) label.textContent = text;
}
// `selection` is a city slug or "all".
function markActive(picker, selection) {
    picker.querySelectorAll(OPTION).forEach((el)=>{
        const value = el.getAttribute("data-studios-city-option");
        el.setAttribute(ACTIVE_ATTR, value === selection ? "true" : "false");
    });
}
// Set the heading's label + active state without touching the hidden inputs.
function reflectSelection(picker, selection) {
    updateLabel(picker, selection === ALL ? allLabel(picker) : cityName(selection) ?? "");
    markActive(picker, selection);
}
// Full selection: drive context (bruce.city) + the hidden filter + the heading.
function applyCitySelection(picker, form, selection) {
    if (selection !== ALL) cityApi()?.set?.(selection); // context: map + placeholders
    syncHiddenFilter(form, selection === ALL ? null : selection);
    reflectSelection(picker, selection);
}
// Nearest city from geolocation, but ONLY if permission is already granted --
// never triggers a cold prompt. null on no permission / no fix / no coords.
async function resolveGrantedGeoCity() {
    try {
        const status = await navigator.permissions?.query({
            name: "geolocation"
        });
        if (status?.state !== "granted") return null;
    } catch  {
        return null; // Permissions API unsupported -> never prompt.
    }
    const coords = await (0, _locationJs.requestUserLocation)();
    return (0, _studiosCitySelectJs.nearestCitySlug)(coords, cityApi()?.all?.() ?? []);
}
// Strong-signal initial engagement. Runs after Finsweet has bound the list.
async function engageInitial(picker, form) {
    const urlCitySlug = cityApi()?.urlSelection?.()[0]?.slug ?? null;
    const replay = (0, _studiosDeepLinkJs.shouldApplyDeepLinkFilters)(getNavigationType());
    if (urlCitySlug) {
        if (replay) applyCitySelection(picker, form, urlCitySlug);
        else {
            // Back/forward: Finsweet restores the hidden city input itself from the
            // URL it owns. Don't re-click (would double-check + desync). Mirror the
            // URL city into context + heading only.
            cityApi()?.set?.(urlCitySlug);
            reflectSelection(picker, urlCitySlug);
        }
        return;
    }
    // No ?city= -> default to "all"; a granted-geo fix may upgrade it.
    applyCitySelection(picker, form, ALL);
    if (!replay) return; // back/forward with no city -> leave at all
    const geoSlug = await resolveGrantedGeoCity();
    if (geoSlug) applyCitySelection(picker, form, (0, _studiosCitySelectJs.resolveInitialCitySelection)({
        urlCitySlug: null,
        geoNearestSlug: geoSlug
    }));
}
function setupPicker(picker, form) {
    picker.addEventListener("click", (e)=>{
        const opt = /** @type {Element} */ e.target?.closest?.(OPTION);
        if (!opt || !picker.contains(opt)) return;
        const selection = opt.getAttribute("data-studios-city-option");
        if (selection) applyCitySelection(picker, form, selection);
    });
}
// Defer to Finsweet's list callback so the initial hidden-input clicks land
// AFTER FS has bound the form (clicking earlier no-ops). studios.js registers
// its own "list" callback at module top-level (import time); ours registers on
// DOMContentLoaded, so its hooks are wired before our engagement runs.
function boot() {
    const picker = document.querySelector(PICKER);
    const form = document.querySelector(FILTERS_FORM);
    if (!(picker instanceof HTMLElement) || !(form instanceof HTMLElement)) return;
    /** @type {any} */ window.FinsweetAttributes ||= [];
    /** @type {any} */ window.FinsweetAttributes.push([
        "list",
        (listInstances)=>{
            const hasStudios = listInstances.some((i)=>i.instance === FS_LIST_INSTANCE_KEY);
            if (!hasStudios || picker.dataset.cityPickerInit) return;
            picker.dataset.cityPickerInit = "true";
            setupPicker(picker, form);
            engageInitial(picker, form);
        }
    ]);
}
if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, {
        once: true
    });
    else boot();
}

},{"./studios-city-select.js":"8l9bA","./studios-deep-link.js":"l1Yag","./location.js":"WOwQU"}],"8l9bA":[function(require,module,exports,__globalThis) {
/**
 * Pure decision helpers for the studios heading city picker
 * (studios-city-filter.js). Framework-free (no DOM, no globals) so the
 * "which city is the initial filter selection, which hidden inputs do we
 * click, and which city is nearest" rules live in one unit-testable place —
 * mirroring studios-deep-link.js.
 */ var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
/**
 * Nearest city slug to a [lng, lat] coord, or null when coords is null or no
 * city has coords.
 * @param {[number, number] | null} coords
 * @param {{ slug: string, coords: [number, number] | null }[]} cities
 * @returns {string | null}
 */ parcelHelpers.export(exports, "nearestCitySlug", ()=>nearestCitySlug);
/**
 * The initial FILTER selection at page load (strong-signal rule): a ?city=
 * deep-link or geo-if-granted engages the filter; everything else (saved
 * choice, CMS default) leaves it OFF ("all").
 *
 * @param {{ urlCitySlug: string | null, geoNearestSlug: string | null }} input
 * @returns {string} a city slug, or "all"
 */ parcelHelpers.export(exports, "resolveInitialCitySelection", ()=>resolveInitialCitySelection);
/**
 * The hidden city inputs to .click(), in order, to move the single-select
 * Finsweet city group from its current checked value to the target. Works in
 * fs-list-value terms (the city name); the DOM layer maps slug -> value.
 * Mirrors the "one genuine click per change" rule so we never leave two copies
 * checked, and is idempotent when already on the target.
 *
 * @param {{ targetValue: string | null, currentValue: string | null }} input
 *   targetValue  value to end up checked, or null for "all" (none checked)
 *   currentValue value currently checked, or null when none is
 * @returns {string[]} values to click, in order
 */ parcelHelpers.export(exports, "planCityFilterClicks", ()=>planCityFilterClicks);
const EARTH_RADIUS_KM = 6371;
const toRad = (deg)=>deg * Math.PI / 180;
/**
 * Great-circle distance (km) between two [lng, lat] points.
 * @param {[number, number]} a
 * @param {[number, number]} b
 */ function haversineKm(a, b) {
    const [lng1, lat1] = a;
    const [lng2, lat2] = b;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(s));
}
function nearestCitySlug(coords, cities) {
    if (!coords) return null;
    let best = null;
    let bestDist = Infinity;
    for (const c of cities){
        if (!c.coords) continue;
        const d = haversineKm(coords, c.coords);
        if (d < bestDist) {
            bestDist = d;
            best = c.slug;
        }
    }
    return best;
}
function resolveInitialCitySelection({ urlCitySlug, geoNearestSlug }) {
    if (urlCitySlug) return urlCitySlug;
    if (geoNearestSlug) return geoNearestSlug;
    return "all";
}
function planCityFilterClicks({ targetValue, currentValue }) {
    if (targetValue === currentValue) return [];
    const clicks = [];
    if (currentValue !== null) clicks.push(currentValue); // uncheck old
    if (targetValue !== null) clicks.push(targetValue); // check new
    return clicks;
}

},{"@parcel/transformer-js/src/esmodule-helpers.js":"4PAvJ"}]},["ctcwF","efEHR"], "efEHR", "parcelRequire08d4", {})

//# sourceMappingURL=studios.js.map
