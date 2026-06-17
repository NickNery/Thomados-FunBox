import type { TextAnimationPayload, TextAnimationType } from '../cep/bridge';

type TextAnimationPreset = {
  type: TextAnimationType;
  name: string;
  duration: number;
  accent: string;
  preview: 'pop' | 'slide' | 'scale' | 'type';
};

type TextAnimationGalleryProps = {
  isApplying: boolean;
  onApply: (payload: TextAnimationPayload) => Promise<void>;
};

const PRESETS: TextAnimationPreset[] = [
  {
    type: 'pop-in',
    name: 'Pop-in',
    duration: 1.2,
    accent: 'from-amber-300 to-orange-400',
    preview: 'pop'
  },
  {
    type: 'slide-up',
    name: 'Slide Up',
    duration: 1.4,
    accent: 'from-sky-300 to-cyan-400',
    preview: 'slide'
  },
  {
    type: 'fade-scale',
    name: 'Fade Scale',
    duration: 1.5,
    accent: 'from-fuchsia-300 to-rose-400',
    preview: 'scale'
  },
  {
    type: 'typewriter',
    name: 'Typewriter',
    duration: 2,
    accent: 'from-emerald-300 to-lime-400',
    preview: 'type'
  }
];

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
  return (
    <section className="rounded-lg border border-funbox-line bg-funbox-panel p-4 shadow-xl shadow-black/20">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">Animacoes de Texto</h2>
        <p className="text-sm text-zinc-400">Insere um texto animado no playhead usando templates MOGRT.</p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.type}
            type="button"
            onClick={() =>
              onApply({
                type: preset.type,
                duration: preset.duration,
                text: 'THOMADOS',
                videoTrackOffset: 0
              })
            }
            disabled={isApplying}
            className="group overflow-hidden rounded-lg border border-funbox-line bg-[#101218] text-left transition hover:-translate-y-0.5 hover:border-funbox-accent hover:bg-[#151923] disabled:cursor-not-allowed disabled:opacity-70"
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
        ))}
      </div>
    </section>
  );
}
