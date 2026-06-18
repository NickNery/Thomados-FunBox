import { useState } from 'react';
import AudioLibrary from './components/AudioLibrary';
import BezierCurveEditor from './components/BezierCurveEditor';
import TextAnimationGallery from './components/TextAnimationGallery';
import {
  applyTemporalEaseToSelection,
  applyTextAnimation,
  bakeCurveToSelection,
  evalHostScript,
  importAndInsertAudio,
  isCepRuntime
} from './cep/bridge';
import type { BakeCurvePayload, TemporalEasePayload, TextAnimationPayload } from './cep/bridge';

type PingState = {
  loading: boolean;
  output: string;
  error: string;
};

type ApplyMode = 'bezier' | 'bake' | 'text' | 'audio';

type ApplyState = PingState & {
  mode: ApplyMode | null;
};

export default function App() {
  const [ping, setPing] = useState<PingState>({
    loading: false,
    output: '',
    error: ''
  });
  const [applyState, setApplyState] = useState<ApplyState>({
    loading: false,
    output: '',
    error: '',
    mode: null
  });

  async function handleHostPing() {
    setPing({ loading: true, output: '', error: '' });

    try {
      const result = await evalHostScript('thomadosFunBox_ping()');
      setPing({ loading: false, output: result, error: '' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPing({ loading: false, output: '', error: message });
    }
  }

  async function runApply(mode: ApplyMode, runner: () => Promise<unknown>) {
    setApplyState({ loading: true, output: '', error: '', mode });

    try {
      const response = await runner();
      const formatted = JSON.stringify(response, null, 2);
      const isOk = typeof response === 'object' && response !== null && 'ok' in response && response.ok === true;

      setApplyState({
        loading: false,
        output: formatted,
        error: isOk ? '' : (response as { message?: string }).message || formatted,
        mode: null
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setApplyState({ loading: false, output: '', error: message, mode: null });
    }
  }

  return (
    <main className="min-h-screen bg-funbox-background text-zinc-100">
      <section className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-5 py-6">
        <header className="border-b border-funbox-line pb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-funbox-accent">
            Premiere Pro CEP Panel
          </p>
          <h1 className="mt-3 text-3xl font-bold">Thomados FunBox</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            Editor visual de curvas para speed e influence de keyframes.
          </p>
        </header>

        <BezierCurveEditor
          isApplying={applyState.loading && applyState.mode === 'bezier'}
          isBaking={applyState.loading && applyState.mode === 'bake'}
          onApply={(payload: TemporalEasePayload) => runApply('bezier', () => applyTemporalEaseToSelection(payload))}
          onBake={(payload: BakeCurvePayload) => runApply('bake', () => bakeCurveToSelection(payload))}
        />

        <TextAnimationGallery
          isApplying={applyState.loading && applyState.mode === 'text'}
          onApply={(payload: TextAnimationPayload) => runApply('text', () => applyTextAnimation(payload))}
        />

        <AudioLibrary
          isInserting={applyState.loading && applyState.mode === 'audio'}
          onInsert={(absoluteFilePath) => runApply('audio', () => importAndInsertAudio(absoluteFilePath))}
        />

        {(applyState.output || applyState.error) && (
          <pre className="max-h-56 overflow-auto rounded-md border border-funbox-line bg-black/30 p-3 text-xs leading-5 text-zinc-200">
            {applyState.error || applyState.output}
          </pre>
        )}

        <section className="rounded-lg border border-funbox-line bg-funbox-panel p-4 shadow-xl shadow-black/20">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">Ponte com o Premiere</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Runtime: {isCepRuntime() ? 'CEP detectado' : 'Navegador/Vite'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleHostPing}
              disabled={ping.loading}
              className="rounded-md bg-funbox-accent px-3 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {ping.loading ? 'Testando...' : 'Testar JSX'}
            </button>
          </div>

          {(ping.output || ping.error) && (
            <pre className="mt-4 max-h-56 overflow-auto rounded-md border border-funbox-line bg-black/30 p-3 text-xs leading-5 text-zinc-200">
              {ping.error || ping.output}
            </pre>
          )}
        </section>
      </section>
    </main>
  );
}
