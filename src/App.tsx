import { useEffect, useState } from 'react';
import AudioLibrary from './components/AudioLibrary';
import BezierCurveEditor from './components/BezierCurveEditor';
import DiagnosticsPanel from './components/DiagnosticsPanel';
import MediaDownloader from './components/MediaDownloader';
import TextAnimationGallery from './components/TextAnimationGallery';
import {
  applyTemporalEaseToSelection,
  applyCapturedTextAnimation,
  bakeCurveToSelection,
  captureTextAnimationFromSelection,
  evalHostScript,
  getRuntimeInfo,
  importAndInsertAudio,
  isCepRuntime
} from './cep/bridge';
import type {
  ApplyCapturedTextAnimationPayload,
  BakeCurvePayload,
  RuntimeInfoResponse,
  TemporalEasePayload
} from './cep/bridge';
import { recordDiagnostic } from './diagnostics/logger';

type PingState = {
  loading: boolean;
  output: string;
  error: string;
};

type ApplyMode = 'bezier' | 'bake' | 'text' | 'audio';

type ApplyState = PingState & {
  mode: ApplyMode | null;
};

type RuntimeState = {
  loading: boolean;
  info: RuntimeInfoResponse | null;
  error: string;
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
  const [runtime, setRuntime] = useState<RuntimeState>({
    loading: true,
    info: null,
    error: ''
  });

  useEffect(() => {
    if (!isCepRuntime()) {
      setRuntime({ loading: false, info: null, error: '' });
      return;
    }

    getRuntimeInfo()
      .then((info) => setRuntime({ loading: false, info, error: '' }))
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        setRuntime({ loading: false, info: null, error: message });
      });
  }, []);

  async function handleHostPing() {
    setPing({ loading: true, output: '', error: '' });

    try {
      const result = await evalHostScript('thomadosFunBox_ping()');
      recordDiagnostic({ functionName: 'thomadosFunBox_ping', response: result });
      setPing({ loading: false, output: result, error: '' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      recordDiagnostic({ functionName: 'thomadosFunBox_ping', error: message });
      setPing({ loading: false, output: '', error: message });
    }
  }

  async function runApply(mode: ApplyMode, runner: () => Promise<unknown>) {
    if (runtime.info && runtime.info.compatible === false) {
      setApplyState({
        loading: false,
        output: '',
        error: `Versão incompatível: ${runtime.info.appVersion}. Este build exige o Premiere Pro 26.2.2.`,
        mode: null
      });
      return;
    }

    setApplyState({ loading: true, output: '', error: '', mode });

    try {
      const response = await runner();
      const formatted = JSON.stringify(response, null, 2);
      const isOk = typeof response === 'object' && response !== null && 'ok' in response && response.ok === true;

      setApplyState({
        loading: false,
        output: formatted,
        error: isOk ? '' : formatted,
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
            Painel CEP para Premiere Pro
          </p>
          <h1 className="mt-3 text-3xl font-bold">Thomados FunBox</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            Curvas, animações, áudios e downloads para o Premiere Pro.
          </p>
        </header>

        <div
          className={`border-l-4 px-3 py-2 text-sm ${
            runtime.error || runtime.info?.compatible === false
              ? 'border-red-500 bg-red-950/30 text-red-200'
              : runtime.info?.compatible
                ? 'border-emerald-500 bg-emerald-950/30 text-emerald-200'
                : 'border-zinc-600 bg-zinc-900 text-zinc-300'
          }`}
        >
          {runtime.loading && 'Validando Premiere Pro 26.2.2...'}
          {!runtime.loading && runtime.info?.compatible &&
            `Premiere ${runtime.info.appVersion} / CEP 12: pronto`}
          {!runtime.loading && runtime.info?.compatible === false &&
            `Host ${runtime.info.appVersion} incompatível; esperado 26.2.2`}
          {!runtime.loading && runtime.error && runtime.error}
          {!runtime.loading && !runtime.info && !runtime.error && 'Prévia no navegador; comandos do Premiere desativados.'}
        </div>

        <BezierCurveEditor
          isApplying={applyState.loading && applyState.mode === 'bezier'}
          isBaking={applyState.loading && applyState.mode === 'bake'}
          onApply={(payload: TemporalEasePayload) => runApply('bezier', () => applyTemporalEaseToSelection(payload))}
          onBake={(payload: BakeCurvePayload) => runApply('bake', () => bakeCurveToSelection(payload))}
        />

        <TextAnimationGallery
          isApplying={applyState.loading && applyState.mode === 'text'}
          onCapture={captureTextAnimationFromSelection}
          onApply={(payload: ApplyCapturedTextAnimationPayload) =>
            runApply('text', () => applyCapturedTextAnimation(payload))
          }
        />

        <AudioLibrary
          isInserting={applyState.loading && applyState.mode === 'audio'}
          onInsert={(absoluteFilePath) => runApply('audio', () => importAndInsertAudio(absoluteFilePath))}
        />

        <MediaDownloader />

        {(applyState.output || applyState.error) && (
          <pre className="max-h-56 overflow-auto rounded-md border border-funbox-line bg-black/30 p-3 text-xs leading-5 text-zinc-200">
            {applyState.error || applyState.output}
          </pre>
        )}

        <DiagnosticsPanel />

        <section className="rounded-lg border border-funbox-line bg-funbox-panel p-4 shadow-xl shadow-black/20">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">Ponte com o Premiere</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Ambiente: {isCepRuntime() ? 'CEP detectado' : 'Navegador/Vite'}
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
