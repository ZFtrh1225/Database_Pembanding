const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const source = html.slice(html.indexOf('var _mMap = null'), html.indexOf('var _mapInited = false'));
assert.ok(source.includes('function mAddMeasurementData()'));

// Minimal DOM and map doubles execute production Measurement without network
// access or paid map services. Visual layout still needs a browser check.
function setup(reduceMotion = false) {
  const nodes = new Map(), timers = [], layers = new Set();
  let focused = null, routeCalls = 0;
  function node(tag = 'div') {
    const element = {
      tagName:tag.toUpperCase(), className:'', id:'', value:'', textContent:'', style:{},
      attributes:{}, children:[], events:{}, offsetTop:0, _html:'',
      setAttribute(key, value) { this.attributes[key] = String(value); },
      addEventListener(name, handler) { this.events[name] = handler; },
      appendChild(child) {
        child.offsetTop = this.children.length * 120;
        this.children.push(child); if (child.id) nodes.set(child.id, child);
        return child;
      },
      querySelector(selector) {
        return this.children.find(child => selector[0] === '.' ?
          child.className.split(' ').includes(selector.slice(1)) : child.tagName.toLowerCase() === selector) || null;
      },
      focus(options) { focused = this; this.focusOptions = options; },
      scrollTo(options) { this.lastScroll = options; },
      get innerHTML() { return this._html; },
      set innerHTML(value) {
        this._html = value; this.children = [];
        for (const match of value.matchAll(/<(div|span|input|button)\b([^>]*)>/g)) {
          const child = node(match[1]);
          for (const attr of match[2].matchAll(/([\w-]+)="([^"]*)"/g)) {
            child.attributes[attr[1]] = attr[2];
            if (attr[1] === 'id') { child.id = attr[2]; nodes.set(child.id, child); }
            if (attr[1] === 'class') child.className = attr[2];
          }
          this.children.push(child);
        }
      }
    };
    element.classList = {
      contains(name) { return element.className.split(' ').includes(name); },
      add(...names) { element.className = [...new Set(element.className.split(' ').filter(Boolean).concat(names))].join(' '); },
      remove(...names) { element.className = element.className.split(' ').filter(name => !names.includes(name)).join(' '); },
      toggle(name, force) {
        const enabled = force === undefined ? !this.contains(name) : !!force;
        if (enabled) this.add(name); else this.remove(name);
        return enabled;
      }
    };
    return element;
  }
  const overlay = html.slice(html.indexOf('<!-- ===================== MEASUREMENT OVERLAY'), html.indexOf('<!-- ==================== END MEASUREMENT'));
  const parsed = node(); parsed.innerHTML = overlay;
  const document = {
    hidden:false, body:node('body'), getElementById:id => nodes.get(id) || null,
    createElement:node, addEventListener() {}
  };
  nodes.get('measureOverlay').classList.add('open');
  const osmMap = {
    getZoom:() => 14, hasLayer:layer => layers.has(layer), removeLayer:layer => layers.delete(layer),
    fitBounds() {}, setView() {}, invalidateSize() {}, zoomIn() {}, zoomOut() {}
  };
  function osmLayer(options) {
    return { options, path:{ style:{} },
      addTo() { layers.add(this); return this; }, getElement() { return this.path; },
      setIcon(icon) { this.options.icon = icon; }
    };
  }
  class Polyline {
    constructor(options) { this.options = options; this.map = options.map; }
    setMap(map) { this.map = map; }
  }
  const google = { maps:{
    LatLngBounds:class { extend() {} },
    Point:class { constructor(x, y) { this.x = x; this.y = y; } },
    Size:class { constructor(width, height) { this.width = width; this.height = height; } },
    Marker:class {
      constructor(options) { this.options = options; }
      setMap(map) { this.map = map; }
    },
    OverlayView:class { setMap(map) { this.map = map; } },
    Polyline, event:{ trigger() {} }
  } };
  const env = {
    document, google, L:{
      divIcon:options => options,
      marker:(coords, options) => osmLayer(options),
      polyline:(points, options) => osmLayer(options)
    },
    window:{ google, matchMedia:() => ({ matches:reduceMotion }) },
    requestAnimationFrame:() => 1, cancelAnimationFrame() {},
    setTimeout:fn => { timers.push(fn); return timers.length; }, clearTimeout() {},
    toast() {}, _isViewerRole:() => false, activeRole:'Admin',
    localStorage:{ getItem:() => null }, sessionStorage:{ getItem:() => null }
  };
  function expose() {
    _mMap = { getZoom:function() { return 14; }, fitBounds:function() {}, setCenter:function() {}, setZoom:function() {} };
    _mMapInited = true; _mOsmMap = env.osmMap; _mOsmInited = true;
    _mComputeRoadRoute = function(origin, destination) { return env.road(origin, destination); };
    return {
      ensure:_mEnsureDataCards, add:mAddMeasurementData, open:openMeasurement, close:closeMeasurement,
      reset:mResetAll, redraw:_mRedraw, osmRedraw:_mOsmRedraw, toggle:toggleMeasureOSM,
      toggleLines:toggleMeasurementLines, queue:_mRunRouteQueue, color:_mGetDataColor,
      ids:function() { return _mDpIds.slice(); },
      mode:function(osm) { _mOsmActive = osm; },
      snapshot:function() { return { pick:_mPickTarget, markers:_mMks, routes:_mRoutes, osmMarkers:_mOsmMarkers, osmLines:_mOsmLines }; }
    };
  }
  const exposeText = expose.toString();
  const exposeBody = exposeText.slice(exposeText.indexOf('{') + 1, exposeText.lastIndexOf('}'));
  const api = new Function('env', 'with (env) {\n' + source + exposeBody + '\n}')({
    ...env, osmMap,
    road:async (origin, destination) => {
      routeCalls++;
      return { path:[origin, destination], meters:1000 + destination.lat, durationMillis:60000, source:'modern' };
    }
  });
  return { api, document, nodes, timers, get focused() { return focused; }, get routeCalls() { return routeCalls; } };
}
async function settle() { for (let i = 0; i < 250; i++) await Promise.resolve(); }
function fillThrough20(h) {
  h.api.ensure();
  while (h.api.ids().length < 20) h.api.add();
  h.nodes.get('mCoord_obj').value = '-6.2, 106.8';
  h.api.ids().forEach(id => { h.nodes.get('mCoord_' + id).value = (-6.2 + Number(id) / 1000) + ', 106.81'; });
}

test('initial six cards are created once and add clicks reach Data 20 without losing input', () => {
  const h = setup(); h.api.ensure();
  assert.deepEqual(h.api.ids(), ['1','2','3','4','5','6']);
  h.nodes.get('mCoord_1').value = '-6.2, 106.8';
  const first = h.nodes.get('mpCard_1');
  h.api.ensure();
  assert.equal(h.api.ids().length, 6);
  h.api.add();
  assert.equal(h.api.ids().at(-1), '7');
  while (h.api.ids().length < 20) h.api.add();
  assert.equal(h.api.ids().at(-1), '20');
  assert.equal(h.nodes.get('mDataCards').children.length, 20);
  assert.equal(h.nodes.get('mpCard_1'), first);
  assert.equal(h.nodes.get('mCoord_1').value, '-6.2, 106.8');
});

test('new card receives focus and scrolling without opening the coordinate keyboard', () => {
  const h = setup(); h.api.add();
  assert.equal(h.focused, h.nodes.get('mpCard_7'));
  assert.equal(h.focused.tabIndex, -1);
  assert.equal(h.focused.focusOptions.preventScroll, true);
  assert.equal(h.nodes.get('mPointsScroll').lastScroll.behavior, 'smooth');
  assert.match(h.nodes.get('mDataStatus').textContent, /Data 7.*7 data/);
  const reduced = setup(true); reduced.api.add();
  assert.equal(reduced.nodes.get('mPointsScroll').lastScroll.behavior, 'auto');
});

test('each new input, clear button and map picker controls its own data ID', () => {
  const h = setup(); h.api.add();
  const card = h.nodes.get('mpCard_7'), input = h.nodes.get('mCoord_7');
  input.value = '-6.19, 106.81';
  input.events.input();
  assert.equal(input.classList.contains('valid'), true);
  input.events.blur();
  assert.equal(card.classList.contains('has-val'), true);
  card.querySelector('.mpt-pick').events.click();
  assert.equal(h.api.snapshot().pick, '7');
  assert.match(h.nodes.get('mpickLabel').textContent, /Data 7/);
  card.querySelector('.mpt-clear').events.click();
  assert.equal(input.value, '');
  assert.equal(card.classList.contains('has-val'), false);
});

test('one stable color is used for each card, OSM marker, line and summary through Data 20', () => {
  const h = setup(); fillThrough20(h); h.api.osmRedraw();
  const state = h.api.snapshot();
  assert.equal(state.osmMarkers.length, 21);
  assert.equal(state.osmLines.length, 20);
  assert.equal(new Set(h.api.ids().map(h.api.color)).size, 20);
  h.api.ids().forEach((id, index) => {
    const color = h.api.color(id);
    assert.notEqual(color, '#db4437');
    assert.ok(h.nodes.get('mpCard_' + id).innerHTML.includes('background:' + color));
    assert.ok(state.osmMarkers[index + 1].options.icon.html.includes('fill="' + color + '"'));
    assert.equal(state.osmLines[index].options.color, color);
    assert.ok(h.nodes.get('mSummaryRows').innerHTML.includes('background:' + color));
    assert.match(h.nodes.get('mDist_' + id).textContent, /lurus/);
  });
});

test('blank added cards do not redraw existing markers or request Google routes', async () => {
  const h = setup(); fillThrough20(h); h.api.mode(false); h.api.redraw(); await settle();
  assert.equal(h.routeCalls, 20);
  const state = h.api.snapshot(), marker = state.markers['1'], route = state.routes['20'];
  h.api.add(); await settle();
  assert.equal(h.routeCalls, 20);
  assert.equal(h.api.snapshot().markers['1'], marker);
  assert.equal(h.api.snapshot().routes['20'], route);
  assert.equal(h.nodes.get('mCoord_21').value, '');
});

test('Google road routes include Data 7 through 20 with matching marker and summary colors', async () => {
  const h = setup(); fillThrough20(h); h.api.mode(false); h.api.redraw(); await settle();
  const state = h.api.snapshot();
  assert.equal(Object.keys(state.routes).length, 20);
  h.api.ids().forEach(id => {
    const color = h.api.color(id);
    assert.equal(state.routes[id].options.strokeColor, color);
    assert.ok(decodeURIComponent(state.markers[id].options.icon.url).includes('fill="' + color + '"'));
    assert.match(h.nodes.get('mDist_' + id).textContent, /mnt/);
    assert.ok(h.nodes.get('mSummaryRows').innerHTML.includes('Data ' + id + '</span>'));
  });
});

test('switching between Google and OSM retains cards and their colors', async () => {
  const h = setup(); fillThrough20(h);
  const input = h.nodes.get('mCoord_20'), color = h.api.color('20');
  h.api.toggle(); await settle();
  assert.equal(Object.keys(h.api.snapshot().routes).length, 20);
  h.api.toggle();
  assert.equal(h.api.snapshot().osmLines.length, 20);
  assert.equal(h.nodes.get('mCoord_20'), input);
  assert.equal(h.api.color('20'), color);
});

test('close and reopen retain all added cards and coordinates without duplicate initialization', () => {
  const h = setup(); fillThrough20(h);
  h.api.close(); h.api.open();
  assert.equal(h.api.ids().length, 20);
  assert.equal(h.nodes.get('mDataCards').children.length, 20);
  assert.notEqual(h.nodes.get('mCoord_20').value, '');
  assert.equal(h.nodes.get('measureOverlay').classList.contains('open'), true);
});

test('reset clears every coordinate including Data 20, pending pick, layers and summary', () => {
  const h = setup(); fillThrough20(h); h.api.osmRedraw();
  h.nodes.get('mpCard_20').querySelector('.mpt-pick').events.click();
  h.api.reset();
  ['obj', ...h.api.ids()].forEach(id => assert.equal(h.nodes.get('mCoord_' + id).value, ''));
  assert.equal(h.api.snapshot().pick, null);
  assert.equal(h.api.snapshot().osmLines.length, 0);
  assert.equal(h.api.snapshot().osmMarkers.length, 0);
  assert.equal(h.nodes.get('mSummary').style.display, 'none');
  assert.equal(h.api.ids().length, 20);
});

test('line visibility control applies to newly added data in both map modes', async () => {
  const h = setup(); fillThrough20(h); h.api.toggleLines(); h.api.osmRedraw();
  h.api.mode(false); h.api.redraw(); await settle();
  assert.equal(h.api.snapshot().routes['20'].map, null);
  assert.equal(h.nodes.get('mLinesToggle').attributes['aria-pressed'], 'false');
  h.api.toggleLines();
  assert.notEqual(h.api.snapshot().routes['20'].map, null);
});

test('road queue limits simultaneous requests to three and preserves result order', async () => {
  const h = setup(), releases = []; let active = 0, maximum = 0;
  const result = h.api.queue(Array.from({ length:20 }, (_, i) => i), id => {
    active++; maximum = Math.max(maximum, active);
    return new Promise(resolve => releases.push(() => { active--; resolve(id); }));
  }, () => true);
  for (let round = 0; round < 25; round++) {
    await Promise.resolve();
    releases.splice(0).reverse().forEach(release => release());
  }
  const values = await result;
  assert.equal(maximum, 3);
  assert.deepEqual(values, Array.from({ length:20 }, (_, i) => i));
});

test('stale road queue stops launching remaining requests after close, reset or mode changes', async () => {
  const h = setup(), releases = []; let current = true, launched = 0;
  const result = h.api.queue(Array.from({ length:20 }, (_, i) => i), id => {
    launched++; return new Promise(resolve => releases.push(() => resolve(id)));
  }, () => current);
  await Promise.resolve();
  current = false; releases.forEach(release => release());
  await result;
  assert.equal(launched, 3);
});

test('mobile footer stays outside the scrolling list and inputs have touch targets and safe area', () => {
  const overlay = html.slice(html.indexOf('<!-- ===================== MEASUREMENT OVERLAY'), html.indexOf('<!-- ==================== END MEASUREMENT'));
  assert.match(overlay, /<\/div><!-- \.msb-scroll -->\s*<div class="msb-footer">/);
  assert.match(overlay, /class="msb-add"[^>]+type="button"[^>]+aria-controls="mDataCards"/);
  assert.match(html, /\.msb-scroll \{[^}]*min-height:0;[^}]*overflow-y:auto;/);
  assert.match(html, /\.msb-add \{[\s\S]*?min-height:48px;/);
  assert.match(html, /\.mpt-input \{ min-height:48px;[^}]*font-size:16px;/);
  assert.match(html, /\.msb-footer \{ padding-bottom:max\(10px, env\(safe-area-inset-bottom/);
});
