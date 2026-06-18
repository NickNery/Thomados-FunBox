import { useEffect, useRef, useState } from 'react';

type AudioAsset = {
  name: string;
  absolutePath: string;
  sourceUrl: string;
};

type AudioLibraryProps = {
  isInserting: boolean;
  onInsert: (absoluteFilePath: string) => Promise<void>;
};

type FsModule = {
  existsSync: (path: string) => boolean;
  readdirSync: (path: string) => string[];
  statSync: (path: string) => {
    isFile: () => boolean;
  };
};

type PathModule = {
  basename: (path: string, extension?: string) => string;
  dirname: (path: string) => string;
  extname: (path: string) => string;
  join: (...parts: string[]) => string;
};

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.aif', '.aiff', '.m4a'];

function getNodeRequire() {
  return window.cep_node?.require ?? window.require ?? null;
}

function getPanelFilePath() {
  const decodedPath = decodeURIComponent(window.location.pathname);

  if (window.location.protocol !== 'file:') {
    throw new Error('A biblioteca de audio deve ser aberta dentro do painel CEP compilado.');
  }

  return decodedPath.replace(/^\/([A-Za-z]:)/, '$1').replace(/\//g, '\\');
}

function toFileUrl(absolutePath: string) {
  const normalized = absolutePath.replace(/\\/g, '/');
  const encoded = normalized
    .split('/')
    .map((segment, index) => (index === 0 && /^[A-Za-z]:$/.test(segment) ? segment : encodeURIComponent(segment)))
    .join('/');

  return `file:///${encoded}`;
}

function loadAudioAssets(): AudioAsset[] {
  const nodeRequire = getNodeRequire();

  if (!nodeRequire) {
    throw new Error('Node.js nao esta disponivel neste runtime CEP.');
  }

  const fs = nodeRequire('fs') as FsModule;
  const path = nodeRequire('path') as PathModule;
  const panelRoot = path.dirname(getPanelFilePath());
  const audioDirectory = path.join(panelRoot, 'assets', 'sfx');

  if (!fs.existsSync(audioDirectory)) {
    throw new Error(`Diretorio de audio nao encontrado: ${audioDirectory}`);
  }

  return fs
    .readdirSync(audioDirectory)
    .map((fileName) => path.join(audioDirectory, fileName))
    .filter((absolutePath) => fs.statSync(absolutePath).isFile())
    .filter((absolutePath) => AUDIO_EXTENSIONS.includes(path.extname(absolutePath).toLowerCase()))
    .map((absolutePath) => {
      const extension = path.extname(absolutePath);

      return {
        name: path.basename(absolutePath, extension),
        absolutePath,
        sourceUrl: toFileUrl(absolutePath)
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export default function AudioLibrary({ isInserting, onInsert }: AudioLibraryProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [assets, setAssets] = useState<AudioAsset[]>([]);
  const [activePath, setActivePath] = useState('');
  const [error, setError] = useState('');

  function refreshAssets() {
    try {
      setAssets(loadAudioAssets());
      setError('');
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : String(loadError);

      setAssets([]);
      setError(message);
    }
  }

  useEffect(() => {
    refreshAssets();
  }, []);

  async function togglePreview(asset: AudioAsset) {
    const player = audioRef.current;

    if (!player) {
      return;
    }

    if (activePath === asset.absolutePath && !player.paused) {
      player.pause();
      setActivePath('');
      return;
    }

    player.src = asset.sourceUrl;
    player.currentTime = 0;

    try {
      await player.play();
      setActivePath(asset.absolutePath);
      setError('');
    } catch (playError) {
      const message = playError instanceof Error ? playError.message : String(playError);
      setError(`Falha no preview: ${message}`);
    }
  }

  return (
    <section className="rounded-lg border border-funbox-line bg-funbox-panel p-4 shadow-xl shadow-black/20">
      <audio ref={audioRef} onEnded={() => setActivePath('')} />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Biblioteca de Audios</h2>
          <p className="mt-1 text-sm text-zinc-400">Efeitos locais disponiveis para preview e timeline.</p>
        </div>
        <button
          type="button"
          onClick={refreshAssets}
          className="rounded-md border border-funbox-line px-3 py-2 text-sm font-semibold text-zinc-100 transition hover:border-funbox-accent"
        >
          Recarregar
        </button>
      </div>

      <div className="mt-4 grid gap-2">
        {assets.map((asset) => {
          const isPlaying = activePath === asset.absolutePath;

          return (
            <div
              key={asset.absolutePath}
              className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-funbox-line bg-black/20 p-2"
            >
              <button
                type="button"
                onClick={() => togglePreview(asset)}
                title={isPlaying ? 'Pausar preview' : 'Reproduzir preview'}
                aria-label={isPlaying ? `Pausar ${asset.name}` : `Reproduzir ${asset.name}`}
                className="flex h-10 w-10 items-center justify-center rounded-md border border-funbox-line text-sm text-funbox-accent transition hover:border-funbox-accent"
              >
                <span aria-hidden="true">{isPlaying ? <>&#10074;&#10074;</> : <>&#9654;</>}</span>
              </button>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-100">{asset.name}</p>
                <p className="truncate text-xs text-zinc-500">{asset.absolutePath}</p>
              </div>

              <button
                type="button"
                onClick={() => onInsert(asset.absolutePath)}
                disabled={isInserting}
                className="rounded-md bg-funbox-accent px-3 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isInserting ? 'Adicionando...' : 'Adicionar a Timeline'}
              </button>
            </div>
          );
        })}

        {!error && assets.length === 0 && (
          <div className="rounded-md border border-dashed border-funbox-line px-3 py-6 text-center text-sm text-zinc-400">
            Nenhum arquivo de audio encontrado.
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-900/70 bg-red-950/30 px-3 py-3 text-sm text-red-200">{error}</div>
        )}
      </div>
    </section>
  );
}
