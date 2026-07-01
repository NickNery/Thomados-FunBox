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
import BorderGlow from './react-bits/BorderGlow';
import CardNav from './react-bits/CardNav';
import type { CardNavItem } from './react-bits/CardNav';
import DarkVeil from './react-bits/DarkVeil';

type PingState = {
  loading: boolean;
  output: string;
  error: string;
};

type ApplyMode = 'bezier' | 'bake' | 'text' | 'audio';
type AppTab = 'download' | 'curve' | 'presets' | 'audio' | 'diagnostics';

type ApplyState = PingState & {
  mode: ApplyMode | null;
};

type RuntimeState = {
  loading: boolean;
  info: RuntimeInfoResponse | null;
  error: string;
};

const TAB_LABELS: Record<AppTab, string> = {
  download: 'Download de vídeo',
  curve: 'Editor de curvas',
  presets: 'Presets de keyframes',
  audio: 'Diretórios de áudio',
  diagnostics: 'Diagnóstico'
};

const NAV_ITEMS: CardNavItem<AppTab>[] = [
  {
    label: 'Downloads',
    links: [
      { label: 'Download de vídeo', tabId: 'download', ariaLabel: 'Abrir download de vídeo' }
    ]
  },
  {
    label: 'Animações',
    links: [
      { label: 'Editor de curvas', tabId: 'curve', ariaLabel: 'Abrir editor de curvas' },
      { label: 'Presets', tabId: 'presets', ariaLabel: 'Abrir presets de keyframes' }
    ]
  },
  {
    label: 'Biblioteca',
    links: [
      { label: 'Diretórios de áudio', tabId: 'audio', ariaLabel: 'Abrir diretórios de áudio' },
      { label: 'Diagnóstico', tabId: 'diagnostics', ariaLabel: 'Abrir diagnóstico' }
    ]
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('download');
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

  function renderActiveTab() {
    if (activeTab === 'download') {
      return <MediaDownloader />;
    }

    if (activeTab === 'curve') {
      return (
        <BezierCurveEditor
          isApplying={applyState.loading && applyState.mode === 'bezier'}
          isBaking={applyState.loading && applyState.mode === 'bake'}
          onApply={(payload: TemporalEasePayload) => runApply('bezier', () => applyTemporalEaseToSelection(payload))}
          onBake={(payload: BakeCurvePayload) => runApply('bake', () => bakeCurveToSelection(payload))}
        />
      );
    }

    if (activeTab === 'presets') {
      return (
        <TextAnimationGallery
          isApplying={applyState.loading && applyState.mode === 'text'}
          onCapture={captureTextAnimationFromSelection}
          onApply={(payload: ApplyCapturedTextAnimationPayload) =>
            runApply('text', () => applyCapturedTextAnimation(payload))
          }
        />
      );
    }

    if (activeTab === 'audio') {
      return (
        <AudioLibrary
          isInserting={applyState.loading && applyState.mode === 'audio'}
          onInsert={(absoluteFilePath) => runApply('audio', () => importAndInsertAudio(absoluteFilePath))}
        />
      );
    }

    return (
      <div className="divide-y divide-funbox-line">
        <DiagnosticsPanel />
        <section className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-white">Ponte com o Premiere</h2>
              <p className="mt-1 text-sm text-zinc-300">
                Ambiente: {isCepRuntime() ? 'CEP detectado' : 'Navegador/Vite'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleHostPing}
              disabled={ping.loading}
              className="rounded-md bg-funbox-accent px-3 py-2 text-sm font-semibold text-white transition hover:bg-funbox-secondary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {ping.loading ? 'Testando...' : 'Testar JSX'}
            </button>
          </div>

          {(ping.output || ping.error) && (
            <pre className="mt-4 max-h-56 overflow-auto rounded-md border border-funbox-line bg-funbox-background/70 p-3 text-xs leading-5 text-white">
              {ping.error || ping.output}
            </pre>
          )}
        </section>
      </div>
    );
  }

  const showApplyOutput = activeTab === 'curve' || activeTab === 'presets' || activeTab === 'audio';

  return (
    <main className="relative isolate min-h-screen overflow-x-hidden text-white">
      <div
        className="pointer-events-none fixed inset-0 bg-funbox-background"
        style={{ zIndex: -1 }}
        aria-hidden="true"
      >
        <DarkVeil
          baseColor="#2C2F33"
          veilColor="#4A5466"
          hueShift={0}
          noiseIntensity={0.035}
          scanlineIntensity={0.08}
          scanlineFrequency={1.4}
          speed={0.22}
          warpAmount={0.18}
          resolutionScale={0.65}
        />
      </div>

      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-4 px-4 py-4 sm:px-5 sm:py-5">
        <header className="px-1 pb-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-funbox-accent">
            Painel CEP para Premiere Pro
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white">Thomados FunBox</h1>
        </header>

        <CardNav
          title="Ferramentas"
          items={NAV_ITEMS}
          activeTab={activeTab}
          activeLabel={TAB_LABELS[activeTab]}
          onTabChange={setActiveTab}
          baseColor="#2C2F33"
          secondaryColor="#4A5466"
          activeColor="#4371CC"
        />

        <div
          className="border-l-4 bg-funbox-background/85 px-3 py-2 text-xs text-white"
          style={{ borderColor: runtime.error || runtime.info?.compatible === false ? '#4371CC' : '#4A5466' }}
        >
          {runtime.loading && 'Validando Premiere Pro 26.2.2...'}
          {!runtime.loading && runtime.info?.compatible &&
            `Premiere ${runtime.info.appVersion} / CEP 12: pronto`}
          {!runtime.loading && runtime.info?.compatible === false &&
            `Host ${runtime.info.appVersion} incompatível; esperado 26.2.2`}
          {!runtime.loading && runtime.error && runtime.error}
          {!runtime.loading && !runtime.info && !runtime.error && 'Prévia no navegador; comandos do Premiere desativados.'}
        </div>

        <BorderGlow
          key={activeTab}
          animated
          edgeSensitivity={18}
          glowColor="220 58 53"
          backgroundColor="#2C2F33"
          borderRadius={8}
          glowRadius={28}
          glowIntensity={0.7}
          coneSpread={24}
          colors={['#4371CC', '#4A5466', '#4371CC']}
          fillOpacity={0.22}
          className="min-w-0"
        >
          {renderActiveTab()}

          {showApplyOutput && (applyState.output || applyState.error) && (
            <pre className="mx-4 mb-4 max-h-56 overflow-auto rounded-md border border-funbox-line bg-funbox-background/70 p-3 text-xs leading-5 text-white">
              {applyState.error || applyState.output}
            </pre>
          )}
        </BorderGlow>
      </div>
    </main>
  );
}
