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

function makeParam(
  displayName,
  initialValue,
  initialKeys = [new MockTime(1), new MockTime(2)],
  keyValues,
  sampleValue
) {
  const interpolationWrites = [];
  const values = initialKeys.map((time, index) => ({
    time,
    value: keyValues
      ? keyValues[index]
      : Array.isArray(initialValue)
        ? initialValue.map((item) => item + index * 0.1)
        : initialValue + index * 10
  }));

  function findValue(time) {
    const seconds = Number(time.seconds);
    return values.find((item) => Math.abs(item.time.seconds - seconds) < 0.000001);
  }

  return {
    displayName,
    _values: values,
    _interpolationWrites: interpolationWrites,
    areKeyframesSupported: () => true,
    setTimeVarying: () => 0,
    isTimeVarying: () => true,
    getKeys: () => values.map((item) => item.time),
    getValue: () => initialValue,
    getValueAtKey: (time) => findValue(time)?.value ?? initialValue,
    getValueAtTime: (time) => sampleValue?.(Number(time.seconds)) ?? findValue(time)?.value ?? initialValue,
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
    getInterpolationTypeAtKey: () => 5,
    setInterpolationTypeAtKey: (time, mode) => {
      interpolationWrites.push({ seconds: Number(time.seconds), mode });
      return 0;
    },
    removeKey: (time) => {
      const index = values.indexOf(findValue(time));
      if (index >= 0) values.splice(index, 1);
      return 0;
    }
  };
}

const sequenceZeroPointSeconds = 3599.99424;
const firstPopKey = new MockTime(sequenceZeroPointSeconds);
const lastPopKey = new MockTime(sequenceZeroPointSeconds + 0.6);
const sourceScale = makeParam(
  'Escala',
  100,
  [firstPopKey, lastPopKey],
  [15, 100],
  (seconds) => {
    const progress = Math.max(0, Math.min(1, (seconds - sequenceZeroPointSeconds) / 0.6));
    return 15 + 85 * progress * progress;
  }
);
const sourceClip = {
  name: 'Graphic Clip',
  start: new MockTime(0),
  inPoint: new MockTime(sequenceZeroPointSeconds),
  end: new MockTime(5),
  duration: new MockTime(5),
  components: collection([
    {
      matchName: 'AE.ADBE Vector Motion',
      displayName: 'Movimento vetorial',
      properties: collection([sourceScale])
    }
  ])
};
const targetScale = makeParam('Escala', 100, []);
targetScale.areKeyframesSupported = () => 1;
const targetClip = {
  name: 'Video Clip',
  start: new MockTime(5.875),
  inPoint: new MockTime(4200),
  end: new MockTime(10.875),
  duration: new MockTime(5),
  components: collection([
    { matchName: 'AE.ADBE Motion', displayName: 'Movimento', properties: collection([targetScale]) }
  ])
};
const curveScale = makeParam('Escala', 100, [new MockTime(1), new MockTime(2)]);
const curveClip = {
  name: 'Curve Test Clip',
  start: new MockTime(0),
  end: new MockTime(4),
  duration: new MockTime(4),
  components: collection([
    { matchName: 'AE.ADBE Motion', displayName: 'Movimento', properties: collection([curveScale]) }
  ])
};
let selectedItems = [curveClip];

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
  zeroPoint: '0',
  audioTracks: collection([audioTrack]),
  getSelection: () => collection(selectedItems.slice()),
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

selectedItems = [sourceClip];
const capturedAnimation = parse(api.thomadosFunBox_captureTextAnimation());
assert.equal(capturedAnimation.ok, true);
assert.equal(capturedAnimation.animation.formatVersion, 4);
assert.equal(capturedAnimation.animation.timeBasis, 'clip-offset');
assert.equal(capturedAnimation.animation.sourceSequenceZeroPointSeconds, 0);
assert.equal(capturedAnimation.animation.sourceClipStartSeconds, 0);
assert.ok(Math.abs(capturedAnimation.animation.sourceClipInPointSeconds - sequenceZeroPointSeconds) < 0.000001);
assert.ok(Math.abs(capturedAnimation.animation.sourceHostStartSeconds - sequenceZeroPointSeconds) < 0.000001);
assert.equal(capturedAnimation.animation.properties.length, 1);
assert.equal(capturedAnimation.animation.properties[0].semanticKey, 'scale');
assert.equal(capturedAnimation.animation.properties[0].componentRole, 'vector-motion');
assert.equal(capturedAnimation.animation.properties[0].sourceTimeBasis, 'source-in-point');
assert.equal(capturedAnimation.animation.properties[0].sourceKeyframeCount, 2);
assert.equal(capturedAnimation.animation.properties[0].sampledKeyframeCount, 8);
assert.equal(capturedAnimation.animation.properties[0].curveSampled, true);
assert.equal(capturedAnimation.animation.properties[0].keyframes[0].offsetSeconds, 0);
assert.equal(capturedAnimation.animation.properties[0].keyframes.at(-1).offsetSeconds, 0.6);

selectedItems = [targetClip];

const appliedAnimation = parse(api.thomadosFunBox_applyCapturedTextAnimation({
  presetName: 'Teste capturado',
  animation: capturedAnimation.animation
}));
assert.equal(appliedAnimation.ok, true);
assert.equal(appliedAnimation.applied, 10);
assert.equal(targetScale._values.length, 10);
assert.equal(targetScale._values[0].value, 15);
assert.equal(targetScale._values.at(-1).value, 100);
assert.ok(Math.abs(targetScale._values[0].time.seconds - 4200) < 0.000001);
assert.ok(Math.abs(targetScale._values.at(-1).time.seconds - 4200.6) < 0.000001);
assert.ok(
  targetScale._interpolationWrites.some(
    (entry) => Math.abs(entry.seconds - 4200) < 0.000001 && entry.mode === 0
  )
);
assert.ok(appliedAnimation.diagnostics.some((entry) => entry.includes("Mapeamento: origem='Escala'")));

const legacyAnimation = parse(api.thomadosFunBox_applyCapturedTextAnimation({
  presetName: 'Preset antigo',
  animation: { ...capturedAnimation.animation, formatVersion: 3, timeBasis: 'clip-offset' }
}));
assert.equal(legacyAnimation.ok, false);
assert.match(legacyAnimation.message, /versão anterior/i);

const audio = parse(api.thomadosFunBox_importAndInsertAudio('C:\\audio\\ui-click.wav'));
assert.equal(audio.ok, true);
assert.equal(audio.inserted, true);
assert.equal(inserted.length, 1);
assert.equal(inserted[0].ticks, String(3 * TICKS_PER_SECOND));

console.log('Host JSX tests passed for Premiere Pro 26.2.2 contracts.');
