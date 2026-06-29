import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const TICKS_PER_SECOND = 254016000000;

class MockTime {
  constructor(seconds = 0) {
    this.seconds = seconds;
  }

  get seconds() {
    return this._seconds;
  }

  set seconds(value) {
    this._seconds = Number(value);
    this._ticks = String(Math.round(this._seconds * TICKS_PER_SECOND));
  }

  get ticks() {
    return this._ticks;
  }

  set ticks(value) {
    this._ticks = String(value);
    this._seconds = Number(value) / TICKS_PER_SECOND;
  }

  setSecondsAsFraction(numerator, denominator) {
    this.seconds = numerator / denominator;
  }
}

function collection(items) {
  items.numItems = items.length;
  items.numTracks = items.length;
  return items;
}

function makeParam(displayName, initialValue, initialKeys = [new MockTime(1), new MockTime(2)]) {
  const values = initialKeys.map((time, index) => ({
    time,
    value: Array.isArray(initialValue)
      ? initialValue.map((item) => item + index * 0.1)
      : initialValue + index * 10
  }));

  function findValue(time) {
    const seconds = Number(time.seconds);
    return values.find((item) => Math.abs(item.time.seconds - seconds) < 0.000001);
  }

  return {
    displayName,
    areKeyframesSupported: () => true,
    setTimeVarying: () => 0,
    isTimeVarying: () => true,
    getKeys: () => values.map((item) => item.time),
    getValue: () => initialValue,
    getValueAtKey: (time) => findValue(time)?.value ?? initialValue,
    getValueAtTime: (time) => findValue(time)?.value ?? initialValue,
    addKey: (time) => {
      if (!findValue(time)) {
        values.push({ time, value: initialValue });
      }
      return 0;
    },
    setValueAtKey: (time, value) => {
      const found = findValue(time);
      if (found) {
        found.value = value;
      } else {
        values.push({ time, value });
      }
      return 0;
    },
    setInterpolationTypeAtKey: () => 0,
    removeKey: (time) => {
      const index = values.indexOf(findValue(time));
      if (index >= 0) values.splice(index, 1);
      return 0;
    }
  };
}

const start = new MockTime(1);
const end = new MockTime(5);
const position = makeParam('Posicao', [0.5, 0.5], [start, end]);
const scale = makeParam('Escala', 100, [start, end]);
const opacity = makeParam('Opacidade', 100, [start, end]);
const clip = {
  name: 'Graphic Clip',
  start,
  end,
  duration: new MockTime(4),
  components: collection([
    { matchName: 'AE.ADBE Motion', displayName: 'Movimento', properties: collection([position, scale]) },
    { matchName: 'AE.ADBE Opacity', displayName: 'Opacidade', properties: collection([opacity]) }
  ])
};

const inserted = [];
const audioTrack = {
  isLocked: () => false,
  overwriteClip: (projectItem, ticks) => {
    inserted.push({ projectItem, ticks });
    return true;
  }
};

const rootItem = { name: 'Root', children: collection([]) };
const sequence = {
  name: 'Sequence 01',
  audioTracks: collection([audioTrack]),
  getSelection: () => collection([clip]),
  getPlayerPosition: () => new MockTime(3),
  getSettings: () => ({ videoFrameWidth: 1920, videoFrameHeight: 1080 })
};
const project = {
  name: 'Host Test',
  activeSequence: sequence,
  rootItem,
  importFiles: (paths) => {
    rootItem.children.push({
      name: 'ui-click.wav',
      children: collection([]),
      getMediaPath: () => paths[0]
    });
    return true;
  }
};

function MockFile(path) {
  this.fsName = String(path);
  this.name = this.fsName.split(/[\\/]/).pop();
  this.exists = true;
}

const context = vm.createContext({
  app: { name: 'Adobe Premiere Pro', version: '26.2.2', project },
  $: { global: {} },
  File: MockFile,
  Time: MockTime,
  Math,
  Number,
  String,
  Array,
  Error,
  isFinite
});

const source = await readFile('host/host.jsx', 'utf8');
vm.runInContext(source, context, { filename: 'host/host.jsx' });

const api = context.$.global;
const parse = (value) => JSON.parse(value);

const runtime = parse(api.thomadosFunBox_getRuntimeInfo());
assert.equal(runtime.ok, true);
assert.equal(runtime.compatible, true);
assert.equal(runtime.appVersion, '26.2.2');

const ease = parse(api.thomadosFunBox_applyTemporalEase({
  ease: {
    incoming: { speed: 50, influence: 33 },
    outgoing: { speed: 50, influence: 33 }
  }
}));
assert.equal(ease.ok, true);
assert.ok(ease.interpolationApplied > 0);

const bake = parse(api.thomadosFunBox_bakeCurve({
  curve: { outgoing: { x: 0.33, y: 0.1 }, incoming: { x: 0.67, y: 0.9 } },
  bake: { samples: 4, replaceInteriorKeys: false }
}));
assert.equal(bake.ok, true);
assert.ok(bake.bakedKeys > 0);

const textAnimation = parse(api.thomadosFunBox_applyTextAnimation({
  type: 'slide-up',
  duration: 1,
  recipe: { positionYOffset: 120, opacityStart: 0 }
}));
assert.equal(textAnimation.ok, true);
assert.ok(textAnimation.applied > 0);

const audio = parse(api.thomadosFunBox_importAndInsertAudio('C:\\audio\\ui-click.wav'));
assert.equal(audio.ok, true);
assert.equal(audio.inserted, true);
assert.equal(inserted.length, 1);
assert.equal(inserted[0].ticks, String(3 * TICKS_PER_SECOND));

console.log('Host JSX tests passed for Premiere Pro 26.2.2 contracts.');
