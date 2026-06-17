import { useMemo, useRef, useState } from 'react';
import type { BakeCurvePayload, TemporalEasePayload } from '../cep/bridge';

type HandleName = 'outgoing' | 'incoming';

type CurvePoint = {
  x: number;
  y: number;
};

type CurvePreset = {
  id: string;
  name: string;
  outgoing: CurvePoint;
  incoming: CurvePoint;
};

type BezierCurveEditorProps = {
  isApplying: boolean;
  isBaking: boolean;
  onApply: (payload: TemporalEasePayload) => Promise<void>;
  onBake: (payload: BakeCurvePayload) => Promise<void>;
};

const STORAGE_KEY = 'thomados.funbox.bezierCurvePresets';
const WIDTH = 360;
const HEIGHT = 260;
const PAD = 34;
const GRAPH_WIDTH = WIDTH - PAD * 2;
const GRAPH_HEIGHT = HEIGHT - PAD * 2;
const MIN_HANDLE_X = 0.02;
const MAX_HANDLE_X = 0.98;

const DEFAULT_PRESETS: CurvePreset[] = [
  {
    id: 'smooth-ease',
    name: 'Smooth Ease',
    outgoing: { x: 0.33, y: 0.1 },
    incoming: { x: 0.67, y: 0.9 }
  },
  {
    id: 'quick-start',
    name: 'Quick Start',
    outgoing: { x: 0.18, y: 0.8 },
    incoming: { x: 0.74, y: 0.95 }
  },
  {
    id: 'soft-stop',
    name: 'Soft Stop',
    outgoing: { x: 0.32, y: 0.08 },
    incoming: { x: 0.9, y: 0.7 }
  }
];

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function pointToSvg(point: CurvePoint) {
  return {
    x: PAD + point.x * GRAPH_WIDTH,
    y: PAD + (1 - point.y) * GRAPH_HEIGHT
  };
}

function svgToPoint(clientX: number, clientY: number, svg: SVGSVGElement) {
  const rect = svg.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * WIDTH;
  const y = ((clientY - rect.top) / rect.height) * HEIGHT;

  return {
    x: clamp((x - PAD) / GRAPH_WIDTH, MIN_HANDLE_X, MAX_HANDLE_X),
    y: clamp(1 - (y - PAD) / GRAPH_HEIGHT)
  };
}

function createPath(outgoing: CurvePoint, incoming: CurvePoint) {
  const start = pointToSvg({ x: 0, y: 0 });
  const end = pointToSvg({ x: 1, y: 1 });
  const outgoingSvg = pointToSvg(outgoing);
  const incomingSvg = pointToSvg(incoming);

  return [
    `M ${start.x} ${start.y}`,
    `C ${outgoingSvg.x} ${outgoingSvg.y}`,
    `${incomingSvg.x} ${incomingSvg.y}`,
    `${end.x} ${end.y}`
  ].join(' ');
}

function calculateEase(outgoing: CurvePoint, incoming: CurvePoint) {
  const outgoingInfluence = clamp(outgoing.x, MIN_HANDLE_X, 1) * 100;
  const incomingInfluence = clamp(1 - incoming.x, MIN_HANDLE_X, 1) * 100;

  const outgoingSlope = outgoing.y / Math.max(outgoing.x, MIN_HANDLE_X);
  const incomingSlope = (1 - incoming.y) / Math.max(1 - incoming.x, MIN_HANDLE_X);

  return {
    outgoing: {
      speed: round(clamp(outgoingSlope * 100, 0, 10000)),
      influence: round(clamp(outgoingInfluence, 0.1, 100))
    },
    incoming: {
      speed: round(clamp(incomingSlope * 100, 0, 10000)),
      influence: round(clamp(incomingInfluence, 0.1, 100))
    }
  };
}

function loadStoredPresets() {
  if (typeof window === 'undefined') {
    return DEFAULT_PRESETS;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return DEFAULT_PRESETS;
    }

    const parsed = JSON.parse(stored) as CurvePreset[];
    if (!Array.isArray(parsed)) {
      return DEFAULT_PRESETS;
    }

    return [...DEFAULT_PRESETS, ...parsed];
  } catch {
    return DEFAULT_PRESETS;
  }
}

function persistUserPresets(presets: CurvePreset[]) {
  const userPresets = presets.filter((preset) => !DEFAULT_PRESETS.some((item) => item.id === preset.id));
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(userPresets));
}

function makePresetId(name: string) {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
}

export default function BezierCurveEditor({ isApplying, isBaking, onApply, onBake }: BezierCurveEditorProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [outgoing, setOutgoing] = useState<CurvePoint>({ x: 0.33, y: 0.1 });
  const [incoming, setIncoming] = useState<CurvePoint>({ x: 0.67, y: 0.9 });
  const [activeHandle, setActiveHandle] = useState<HandleName | null>(null);
  const [presets, setPresets] = useState<CurvePreset[]>(loadStoredPresets);
  const [selectedPresetId, setSelectedPresetId] = useState(DEFAULT_PRESETS[0].id);
  const [presetName, setPresetName] = useState('Minha curva');
  const [bakeSamples, setBakeSamples] = useState(8);
  const [replaceInteriorKeys, setReplaceInteriorKeys] = useState(true);

  const ease = useMemo(() => calculateEase(outgoing, incoming), [outgoing, incoming]);
  const outgoingSvg = pointToSvg(outgoing);
  const incomingSvg = pointToSvg(incoming);
  const startSvg = pointToSvg({ x: 0, y: 0 });
  const endSvg = pointToSvg({ x: 1, y: 1 });

  function updateHandle(handle: HandleName, point: CurvePoint) {
    if (handle === 'outgoing') {
      setOutgoing({
        x: clamp(point.x, MIN_HANDLE_X, Math.min(incoming.x - 0.02, MAX_HANDLE_X)),
        y: point.y
      });
      return;
    }

    setIncoming({
      x: clamp(point.x, Math.max(outgoing.x + 0.02, MIN_HANDLE_X), MAX_HANDLE_X),
      y: point.y
    });
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!activeHandle || !svgRef.current) {
      return;
    }

    updateHandle(activeHandle, svgToPoint(event.clientX, event.clientY, svgRef.current));
  }

  function loadPreset(id: string) {
    const preset = presets.find((item) => item.id === id);

    if (!preset) {
      return;
    }

    setOutgoing(preset.outgoing);
    setIncoming(preset.incoming);
    setSelectedPresetId(id);
  }

  function savePreset() {
    const trimmedName = presetName.trim() || 'Minha curva';
    const nextPreset: CurvePreset = {
      id: makePresetId(trimmedName),
      name: trimmedName,
      outgoing,
      incoming
    };
    const nextPresets = [...presets, nextPreset];

    setPresets(nextPresets);
    setSelectedPresetId(nextPreset.id);
    persistUserPresets(nextPresets);
  }

  function createPayload(): TemporalEasePayload {
    return {
      curve: {
        outgoing,
        incoming
      },
      ease,
      metadata: {
        presetName,
        createdAt: new Date().toISOString()
      }
    };
  }

  async function applyCurve() {
    await onApply(createPayload());
  }

  async function bakeCurve() {
    await onBake({
      ...createPayload(),
      bake: {
        samples: bakeSamples,
        replaceInteriorKeys
      }
    });
  }

  const isBusy = isApplying || isBaking;

  return (
    <section className="rounded-lg border border-funbox-line bg-funbox-panel p-4 shadow-xl shadow-black/20">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Editor de Curvas</h2>
          <p className="mt-1 text-sm text-zinc-400">Speed / Influence</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <button
            type="button"
            onClick={applyCurve}
            disabled={isBusy}
            className="rounded-md border border-funbox-line px-3 py-2 text-sm font-semibold text-zinc-100 transition hover:border-funbox-accent disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isApplying ? 'Aplicando...' : 'Aplicar Bezier'}
          </button>
          <button
            type="button"
            onClick={bakeCurve}
            disabled={isBusy}
            className="rounded-md bg-funbox-accent px-3 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isBaking ? 'Gerando...' : 'Bake Curve'}
          </button>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Editor visual de curva Bezier"
        className="mt-4 aspect-[18/13] w-full select-none rounded-md border border-funbox-line bg-[#0c0d10]"
        onPointerMove={handlePointerMove}
        onPointerUp={() => setActiveHandle(null)}
        onPointerLeave={() => setActiveHandle(null)}
      >
        <defs>
          <pattern id="curve-grid" width="36" height="32" patternUnits="userSpaceOnUse">
            <path d="M 36 0 L 0 0 0 32" fill="none" stroke="#252932" strokeWidth="1" />
          </pattern>
        </defs>
        <rect x={PAD} y={PAD} width={GRAPH_WIDTH} height={GRAPH_HEIGHT} fill="url(#curve-grid)" />
        <line x1={PAD} y1={PAD + GRAPH_HEIGHT} x2={PAD + GRAPH_WIDTH} y2={PAD + GRAPH_HEIGHT} stroke="#606775" />
        <line x1={PAD} y1={PAD} x2={PAD} y2={PAD + GRAPH_HEIGHT} stroke="#606775" />
        <line x1={startSvg.x} y1={startSvg.y} x2={outgoingSvg.x} y2={outgoingSvg.y} stroke="#f59e0b" strokeDasharray="4 4" />
        <line x1={endSvg.x} y1={endSvg.y} x2={incomingSvg.x} y2={incomingSvg.y} stroke="#38bdf8" strokeDasharray="4 4" />
        <path d={createPath(outgoing, incoming)} fill="none" stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" />
        <circle cx={startSvg.x} cy={startSvg.y} r="4" fill="#a1a1aa" />
        <circle cx={endSvg.x} cy={endSvg.y} r="4" fill="#a1a1aa" />
        <circle
          cx={outgoingSvg.x}
          cy={outgoingSvg.y}
          r="9"
          fill="#f59e0b"
          className="cursor-grab active:cursor-grabbing"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            setActiveHandle('outgoing');
          }}
        />
        <circle
          cx={incomingSvg.x}
          cy={incomingSvg.y}
          r="9"
          fill="#38bdf8"
          className="cursor-grab active:cursor-grabbing"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            setActiveHandle('incoming');
          }}
        />
        <text x={PAD} y={HEIGHT - 9} fill="#9ca3af" fontSize="10">
          Out
        </text>
        <text x={WIDTH - PAD - 12} y={PAD - 12} fill="#9ca3af" fontSize="10">
          In
        </text>
      </svg>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-md border border-funbox-line bg-black/20 p-3">
          <p className="font-semibold text-amber-300">Outgoing</p>
          <p className="mt-1 text-zinc-300">Speed {ease.outgoing.speed}</p>
          <p className="text-zinc-300">Influence {ease.outgoing.influence}%</p>
        </div>
        <div className="rounded-md border border-funbox-line bg-black/20 p-3">
          <p className="font-semibold text-sky-300">Incoming</p>
          <p className="mt-1 text-zinc-300">Speed {ease.incoming.speed}</p>
          <p className="text-zinc-300">Influence {ease.incoming.influence}%</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 rounded-md border border-funbox-line bg-black/20 p-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
        <label className="grid gap-1 text-zinc-300">
          <span className="font-semibold text-zinc-100">Amostras do bake</span>
          <input
            type="number"
            min={1}
            max={32}
            value={bakeSamples}
            onChange={(event) => setBakeSamples(clamp(Number(event.target.value) || 1, 1, 32))}
            className="w-full rounded-md border border-funbox-line bg-[#111318] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-funbox-accent sm:w-28"
          />
        </label>
        <label className="flex items-center gap-2 text-zinc-300">
          <input
            type="checkbox"
            checked={replaceInteriorKeys}
            onChange={(event) => setReplaceInteriorKeys(event.target.checked)}
            className="h-4 w-4 accent-funbox-accent"
          />
          Recriar intervalo
        </label>
      </div>

      <div className="mt-4 grid gap-3">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <select
            value={selectedPresetId}
            onChange={(event) => loadPreset(event.target.value)}
            className="min-w-0 rounded-md border border-funbox-line bg-[#111318] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-funbox-accent"
          >
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => loadPreset(selectedPresetId)}
            className="rounded-md border border-funbox-line px-3 py-2 text-sm font-semibold text-zinc-100 transition hover:border-funbox-accent"
          >
            Carregar
          </button>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input
            value={presetName}
            onChange={(event) => setPresetName(event.target.value)}
            className="min-w-0 rounded-md border border-funbox-line bg-[#111318] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-funbox-accent"
          />
          <button
            type="button"
            onClick={savePreset}
            className="rounded-md border border-funbox-line px-3 py-2 text-sm font-semibold text-zinc-100 transition hover:border-funbox-accent"
          >
            Salvar
          </button>
        </div>
      </div>
    </section>
  );
}
