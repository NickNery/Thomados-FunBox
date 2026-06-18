import { useMemo, useState } from 'react';
import type { TextAnimationPayload, TextAnimationRecipe, TextAnimationType } from '../cep/bridge';

type PreviewKind = 'pop' | 'slide' | 'scale' | 'type';

type TextAnimationPreset = {
  id: string;
  type: TextAnimationType;
  name: string;
  duration: number;
  accent: string;
  preview: PreviewKind;
  recipe?: TextAnimationRecipe;
  custom?: boolean;
};

type TextAnimationGalleryProps = {
  isApplying: boolean;
  onApply: (payload: TextAnimationPayload) => Promise<void>;
};

type CustomPresetDraft = {
  name: string;
  baseType: Exclude<TextAnimationType, 'custom'>;
  duration: number;
  scaleStart: number;
  scaleOvershoot: number;
  positionYOffset: number;
  opacityStart: number;
  reveal: boolean;
};

const STORAGE_KEY = 'thomados.funbox.textAnimationPresets';

const BASE_PRESETS: TextAnimationPreset[] = [
  {
    id: 'pop-in',
    type: 'pop-in',
    name: 'Pop-in',
    duration: 1.2,
    accent: 'from-amber-300 to-orange-400',
    preview: 'pop'
  },
  {
    id: 'slide-up',
    type: 'slide-up',
    name: 'Slide Up',
    duration: 1.4,
    accent: 'from-sky-300 to-cyan-400',
    preview: 'slide'
  },
  {
    id: 'fade-scale',
    type: 'fade-scale',
    name: 'Fade Scale',
    duration: 1.5,
    accent: 'from-fuchsia-300 to-rose-400',
    preview: 'scale'
  },
  {
    id: 'typewriter',
    type: 'typewriter',
    name: 'Typewriter',
    duration: 2,
    accent: 'from-emerald-300 to-lime-400',
    preview: 'type'
  }
];

const BASE_RECIPES: Record<CustomPresetDraft['baseType'], TextAnimationRecipe> = {
  'pop-in': {
    scaleStart: 0,
    scaleOvershoot: 110,
    opacityStart: 0
  },
  'slide-up': {
    positionYOffset: 120,
    opacityStart: 0
  },
  'fade-scale': {
    scaleStart: 92,
    opacityStart: 0
  },
  typewriter: {
    opacityStart: 0,
    reveal: true
  }
};

const DEFAULT_DRAFT: CustomPresetDraft = {
  name: 'Meu preset',
  baseType: 'pop-in',
  duration: 1.2,
  scaleStart: 0,
  scaleOvershoot: 110,
  positionYOffset: 0,
  opacityStart: 0,
  reveal: false
};

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function readNumber(value: string, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return clampNumber(Number.isFinite(parsed) ? parsed : fallback, min, max);
}

function loadCustomPresets(): TextAnimationPreset[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored) as TextAnimationPreset[];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((preset) => preset.custom && preset.recipe);
  } catch {
    return [];
  }
}

function persistCustomPresets(presets: TextAnimationPreset[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets.filter((preset) => preset.custom)));
}

function recipeFromDraft(draft: CustomPresetDraft): TextAnimationRecipe {
  const recipe: TextAnimationRecipe = {};

  if (draft.scaleStart !== 100 || draft.scaleOvershoot !== 100) {
    recipe.scaleStart = draft.scaleStart;
    recipe.scaleOvershoot = draft.scaleOvershoot;
  }

  if (draft.positionYOffset !== 0) {
    recipe.positionYOffset = draft.positionYOffset;
  }

  if (draft.opacityStart !== 100) {
    recipe.opacityStart = draft.opacityStart;
  }

  if (draft.reveal) {
    recipe.reveal = true;
  }

  return recipe;
}

function draftFromBase(baseType: CustomPresetDraft['baseType'], currentName = 'Meu preset'): CustomPresetDraft {
  const recipe = BASE_RECIPES[baseType];
  const basePreset = BASE_PRESETS.find((preset) => preset.type === baseType);

  return {
    name: currentName,
    baseType,
    duration: basePreset?.duration ?? 1.5,
    scaleStart: recipe.scaleStart ?? 100,
    scaleOvershoot: recipe.scaleOvershoot ?? 100,
    positionYOffset: recipe.positionYOffset ?? 0,
    opacityStart: recipe.opacityStart ?? 0,
    reveal: recipe.reveal ?? false
  };
}

function PreviewGlyph({ preset }: { preset: TextAnimationPreset }) {
  if (preset.preview === 'type') {
    return (
      <div className="flex h-16 items-center justify-center gap-1.5">
        {[0, 1, 2, 3].map((item) => (
          <span
            key={item}
            className="h-8 w-2 rounded-sm bg-zinc-100 opacity-90 transition-transform duration-200 group-hover:-translate-y-1"
            style={{ transitionDelay: `${item * 45}ms` }}
          />
        ))}
        <span className="ml-1 h-9 w-1 animate-pulse rounded-sm bg-funbox-accent" />
      </div>
    );
  }

  if (preset.preview === 'slide') {
    return (
      <div className="flex h-16 items-end justify-center">
        <span className="h-8 w-28 translate-y-2 rounded-md bg-zinc-100/90 transition-transform duration-300 group-hover:translate-y-0" />
      </div>
    );
  }

  if (preset.preview === 'scale') {
    return (
      <div className="flex h-16 items-center justify-center">
        <span className="h-9 w-24 scale-90 rounded-md border border-zinc-100/70 bg-zinc-100/20 opacity-70 transition duration-300 group-hover:scale-100 group-hover:opacity-100" />
      </div>
    );
  }

  return (
    <div className="flex h-16 items-center justify-center">
      <span className="h-10 w-24 scale-75 rounded-md bg-zinc-100/90 transition duration-300 group-hover:scale-105" />
    </div>
  );
}

export default function TextAnimationGallery({ isApplying, onApply }: TextAnimationGalleryProps) {
  const [customPresets, setCustomPresets] = useState<TextAnimationPreset[]>(loadCustomPresets);
  const [draft, setDraft] = useState<CustomPresetDraft>(DEFAULT_DRAFT);
  const presets = useMemo(() => [...BASE_PRESETS, ...customPresets], [customPresets]);

  function updateDraft(next: Partial<CustomPresetDraft>) {
    setDraft((current) => ({
      ...current,
      ...next
    }));
  }

  function handleBaseTypeChange(baseType: CustomPresetDraft['baseType']) {
    setDraft((current) => draftFromBase(baseType, current.name));
  }

  function savePreset() {
    const trimmedName = draft.name.trim() || 'Meu preset';
    const basePreset = BASE_PRESETS.find((preset) => preset.type === draft.baseType);
    const nextPreset: TextAnimationPreset = {
      id: `${trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
      type: 'custom',
      name: trimmedName,
      duration: draft.duration,
      accent: basePreset?.accent ?? 'from-zinc-300 to-zinc-500',
      preview: basePreset?.preview ?? 'scale',
      recipe: recipeFromDraft(draft),
      custom: true
    };
    const nextPresets = [...customPresets, nextPreset];

    setCustomPresets(nextPresets);
    persistCustomPresets(nextPresets);
  }

  function removePreset(id: string) {
    const nextPresets = customPresets.filter((preset) => preset.id !== id);

    setCustomPresets(nextPresets);
    persistCustomPresets(nextPresets);
  }

  function applyPreset(preset: TextAnimationPreset) {
    return onApply({
      type: preset.type,
      duration: preset.duration,
      presetName: preset.name,
      recipe: preset.recipe
    });
  }

  return (
    <section className="rounded-lg border border-funbox-line bg-funbox-panel p-4 shadow-xl shadow-black/20">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">Animacoes de Texto</h2>
        <p className="text-sm text-zinc-400">Aplica presets no texto ou graphic clip selecionado na timeline.</p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {presets.map((preset) => (
          <div
            key={preset.id}
            className="group overflow-hidden rounded-lg border border-funbox-line bg-[#101218] transition hover:-translate-y-0.5 hover:border-funbox-accent hover:bg-[#151923]"
          >
            <button
              type="button"
              onClick={() => applyPreset(preset)}
              disabled={isApplying}
              className="w-full text-left disabled:cursor-not-allowed disabled:opacity-70"
            >
              <div className={`h-1 bg-gradient-to-r ${preset.accent}`} />
              <div className="p-3">
                <div className="rounded-md border border-funbox-line bg-black/20">
                  <PreviewGlyph preset={preset} />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="font-semibold text-zinc-100">{preset.name}</span>
                  <span className="rounded-md border border-funbox-line px-2 py-1 text-xs text-zinc-400">
                    {preset.duration}s
                  </span>
                </div>
              </div>
            </button>
            {preset.custom && (
              <div className="border-t border-funbox-line px-3 py-2">
                <button
                  type="button"
                  onClick={() => removePreset(preset.id)}
                  className="text-xs font-semibold text-zinc-400 transition hover:text-red-300"
                >
                  Remover preset
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-funbox-line bg-black/20 p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm text-zinc-300">
            <span className="font-semibold text-zinc-100">Nome</span>
            <input
              value={draft.name}
              onChange={(event) => updateDraft({ name: event.target.value })}
              className="rounded-md border border-funbox-line bg-[#111318] px-3 py-2 text-zinc-100 outline-none focus:border-funbox-accent"
            />
          </label>

          <label className="grid gap-1 text-sm text-zinc-300">
            <span className="font-semibold text-zinc-100">Base</span>
            <select
              value={draft.baseType}
              onChange={(event) => handleBaseTypeChange(event.target.value as CustomPresetDraft['baseType'])}
              className="rounded-md border border-funbox-line bg-[#111318] px-3 py-2 text-zinc-100 outline-none focus:border-funbox-accent"
            >
              {BASE_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.type}>
                  {preset.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm text-zinc-300">
            <span className="font-semibold text-zinc-100">Duracao</span>
            <input
              type="number"
              min={0.25}
              max={8}
              step={0.05}
              value={draft.duration}
              onChange={(event) => updateDraft({ duration: readNumber(event.target.value, draft.duration, 0.25, 8) })}
              className="rounded-md border border-funbox-line bg-[#111318] px-3 py-2 text-zinc-100 outline-none focus:border-funbox-accent"
            />
          </label>

          <label className="grid gap-1 text-sm text-zinc-300">
            <span className="font-semibold text-zinc-100">Opacidade inicial</span>
            <input
              type="number"
              min={0}
              max={100}
              value={draft.opacityStart}
              onChange={(event) => updateDraft({ opacityStart: readNumber(event.target.value, draft.opacityStart, 0, 100) })}
              className="rounded-md border border-funbox-line bg-[#111318] px-3 py-2 text-zinc-100 outline-none focus:border-funbox-accent"
            />
          </label>

          <label className="grid gap-1 text-sm text-zinc-300">
            <span className="font-semibold text-zinc-100">Escala inicial</span>
            <input
              type="number"
              min={0}
              max={300}
              value={draft.scaleStart}
              onChange={(event) => updateDraft({ scaleStart: readNumber(event.target.value, draft.scaleStart, 0, 300) })}
              className="rounded-md border border-funbox-line bg-[#111318] px-3 py-2 text-zinc-100 outline-none focus:border-funbox-accent"
            />
          </label>

          <label className="grid gap-1 text-sm text-zinc-300">
            <span className="font-semibold text-zinc-100">Overshoot</span>
            <input
              type="number"
              min={0}
              max={300}
              value={draft.scaleOvershoot}
              onChange={(event) =>
                updateDraft({ scaleOvershoot: readNumber(event.target.value, draft.scaleOvershoot, 0, 300) })
              }
              className="rounded-md border border-funbox-line bg-[#111318] px-3 py-2 text-zinc-100 outline-none focus:border-funbox-accent"
            />
          </label>

          <label className="grid gap-1 text-sm text-zinc-300">
            <span className="font-semibold text-zinc-100">Slide Y</span>
            <input
              type="number"
              min={-500}
              max={500}
              value={draft.positionYOffset}
              onChange={(event) =>
                updateDraft({ positionYOffset: readNumber(event.target.value, draft.positionYOffset, -500, 500) })
              }
              className="rounded-md border border-funbox-line bg-[#111318] px-3 py-2 text-zinc-100 outline-none focus:border-funbox-accent"
            />
          </label>

          <label className="flex items-center gap-2 self-end text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={draft.reveal}
              onChange={(event) => updateDraft({ reveal: event.target.checked })}
              className="h-4 w-4 accent-funbox-accent"
            />
            Reveal / Typewriter
          </label>
        </div>

        <button
          type="button"
          onClick={savePreset}
          className="mt-3 w-full rounded-md border border-funbox-line px-3 py-2 text-sm font-semibold text-zinc-100 transition hover:border-funbox-accent"
        >
          Salvar preset
        </button>
      </div>
    </section>
  );
}
