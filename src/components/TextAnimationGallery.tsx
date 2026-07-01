import { useState } from 'react';
import type {
  ApplyCapturedTextAnimationPayload,
  CaptureTextAnimationResponse,
  CapturedTextAnimationPreset
} from '../cep/bridge';

type TextAnimationGalleryProps = {
  isApplying: boolean;
  onCapture: () => Promise<CaptureTextAnimationResponse>;
  onApply: (payload: ApplyCapturedTextAnimationPayload) => Promise<void>;
};

const STORAGE_KEY = 'thomados.funbox.capturedTextAnimationPresets.v1';

function loadPresets(): CapturedTextAnimationPreset[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored) as CapturedTextAnimationPreset[];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (preset) =>
        typeof preset.id === 'string' &&
        typeof preset.name === 'string' &&
        Array.isArray(preset.animation?.properties)
    );
  } catch {
    return [];
  }
}

function persistPresets(presets: CapturedTextAnimationPreset[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

function createPresetId(name: string) {
  return `${name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
}

function countSourceKeyframes(preset: CapturedTextAnimationPreset) {
  return preset.animation.properties.reduce(
    (total, property) => total + (property.sourceKeyframeCount ?? property.keyframes.filter((keyframe) => !keyframe.sampled).length),
    0
  );
}

function countSampledKeyframes(preset: CapturedTextAnimationPreset) {
  return preset.animation.properties.reduce(
    (total, property) => total + (property.sampledKeyframeCount ?? property.keyframes.filter((keyframe) => keyframe.sampled).length),
    0
  );
}

function getPropertySummary(preset: CapturedTextAnimationPreset) {
  const labels: Record<string, string> = {
    scale: 'Escala',
    position: 'Posição',
    opacity: 'Opacidade',
    rotation: 'Rotação',
    'anchor-point': 'Ponto de ancoragem'
  };
  const properties = preset.animation.properties
    .map((property) =>
      property.componentKind === 'video-effect'
        ? `${property.componentDisplayName}: ${property.propertyDisplayName}`
        : labels[property.semanticKey || ''] || property.propertyDisplayName
    )
    .filter((name, index, allNames) => allNames.indexOf(name) === index);

  return properties.join(', ');
}

function getPresetTiming(preset: CapturedTextAnimationPreset) {
  const offsets = preset.animation.properties.flatMap((property) =>
    property.keyframes.filter((keyframe) => !keyframe.sampled).map((keyframe) => keyframe.offsetSeconds)
  );

  if (offsets.length === 0) {
    return { start: 0, end: preset.animation.durationSeconds };
  }

  return {
    start: Math.min(...offsets),
    end: Math.max(...offsets)
  };
}

export default function TextAnimationGallery({ isApplying, onCapture, onApply }: TextAnimationGalleryProps) {
  const [presets, setPresets] = useState<CapturedTextAnimationPreset[]>(loadPresets);
  const [presetName, setPresetName] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  async function capturePreset() {
    const name = presetName.trim();

    if (!name) {
      setFeedback({ type: 'error', message: 'Digite um nome para o preset.' });
      return;
    }

    setIsCapturing(true);
    setFeedback(null);

    try {
      const response = await onCapture();

      if (!response.ok || !response.animation) {
        throw new Error(response.message || 'Não foi possível capturar os keyframes.');
      }

      const preset: CapturedTextAnimationPreset = {
        id: createPresetId(name),
        name,
        createdAt: new Date().toISOString(),
        animation: response.animation
      };
      const nextPresets = [...presets, preset];

      setPresets(nextPresets);
      persistPresets(nextPresets);
      setPresetName('');
      const sampledKeyframes = countSampledKeyframes(preset);
      const timing = getPresetTiming(preset);
      setFeedback({
        type: 'success',
        message: `${countSourceKeyframes(preset)} keyframes de ${getPropertySummary(preset)} registrados a partir de ${timing.start.toFixed(2)}s${
          sampledKeyframes > 0 ? `, com ${sampledKeyframes} amostras da curva` : ''
        }.`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setFeedback({ type: 'error', message });
    } finally {
      setIsCapturing(false);
    }
  }

  function removePreset(id: string) {
    const nextPresets = presets.filter((preset) => preset.id !== id);
    setPresets(nextPresets);
    persistPresets(nextPresets);
    setFeedback(null);
  }

  return (
    <section className="p-4">
      <div>
        <h2 className="text-base font-semibold">Biblioteca de animações</h2>
        <p className="mt-1 text-sm text-zinc-400">Presets capturados dos keyframes do clipe selecionado.</p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="grid gap-1 text-sm text-zinc-300">
          <span className="font-semibold text-zinc-100">Nome do preset</span>
          <input
            value={presetName}
            onChange={(event) => setPresetName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                capturePreset();
              }
            }}
            placeholder="Ex.: Entrada suave"
            className="min-w-0 rounded-md border border-funbox-line bg-funbox-background px-3 py-2 text-white outline-none focus:border-funbox-accent"
          />
        </label>
        <button
          type="button"
          onClick={capturePreset}
          disabled={isCapturing || isApplying}
          className="self-end rounded-md bg-funbox-accent px-3 py-2 text-sm font-semibold text-white transition hover:bg-funbox-secondary disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isCapturing ? 'Registrando...' : 'Registrar keyframes'}
        </button>
      </div>

      {feedback && (
        <p
          className={`mt-3 border-l-2 px-3 py-2 text-sm ${
            feedback.type === 'success'
              ? 'border-funbox-secondary bg-funbox-secondary/30 text-white'
              : 'border-funbox-accent bg-funbox-secondary/30 text-white'
          }`}
        >
          {feedback.message}
        </p>
      )}

      <div className="mt-4 divide-y divide-funbox-line border-y border-funbox-line">
        {presets.map((preset) => {
          const timing = getPresetTiming(preset);
          const sampledKeyframes = countSampledKeyframes(preset);
          const isCompatible = preset.animation.formatVersion === 5 && preset.animation.timeBasis === 'clip-offset';

          return (
          <div key={preset.id} className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-100">{preset.name}</p>
              <p className="mt-1 text-xs text-zinc-400">
                {getPropertySummary(preset)} · {countSourceKeyframes(preset)} keyframes
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                Tempo no clipe: {timing.start.toFixed(2)}s → {timing.end.toFixed(2)}s
                {sampledKeyframes > 0 ? ` · ${sampledKeyframes} amostras da curva` : ''}
              </p>
              <p className="mt-1 truncate text-xs text-zinc-500">Origem: {preset.animation.sourceClipName}</p>
              {!isCompatible && (
                <p className="mt-2 text-xs font-semibold text-funbox-accent">Registre novamente este preset.</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onApply({ presetName: preset.name, animation: preset.animation })}
                disabled={isApplying || isCapturing || !isCompatible}
                className="rounded-md bg-funbox-accent px-3 py-2 text-sm font-semibold text-white transition hover:bg-funbox-secondary disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isApplying ? 'Aplicando...' : 'Aplicar'}
              </button>
              <button
                type="button"
                onClick={() => removePreset(preset.id)}
                disabled={isApplying || isCapturing}
                className="rounded-md border border-funbox-line px-3 py-2 text-sm font-semibold text-white transition hover:border-funbox-accent hover:bg-funbox-secondary disabled:cursor-not-allowed disabled:opacity-70"
              >
                Excluir
              </button>
            </div>
          </div>
          );
        })}

        {presets.length === 0 && (
          <p className="py-6 text-center text-sm text-zinc-400">Nenhum preset registrado.</p>
        )}
      </div>
    </section>
  );
}
