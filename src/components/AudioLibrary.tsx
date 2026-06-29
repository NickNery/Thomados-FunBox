import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, Folder, FolderOpen, Pause, Play, Plus, RefreshCw } from 'lucide-react';

type AudioAsset = {
  name: string;
  absolutePath: string;
  sourceUrl: string;
};

type AudioFolder = {
  name: string;
  absolutePath: string;
};

type AudioLibraryProps = {
  isInserting: boolean;
  onInsert: (absoluteFilePath: string) => Promise<void>;
};

type FsModule = {
  existsSync: (path: string) => boolean;
  readdirSync: (path: string) => string[];
  statSync: (path: string) => {
    isDirectory: () => boolean;
    isFile: () => boolean;
  };
};

type PathModule = {
  basename: (path: string, extension?: string) => string;
  dirname: (path: string) => string;
  extname: (path: string) => string;
  join: (...parts: string[]) => string;
  normalize: (path: string) => string;
  relative: (from: string, to: string) => string;
};

type NodeRuntime = {
  fs: FsModule;
  path: PathModule;
};

type DirectoryContents = {
  folders: AudioFolder[];
  assets: AudioAsset[];
};

type Breadcrumb = {
  name: string;
  absolutePath: string;
};

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.aif', '.aiff', '.m4a', '.ogg', '.flac'];
const AUDIO_ROOT_STORAGE_KEY = 'thomados.funbox.audioRoot.v1';

function getNodeRequire() {
  return window.cep_node?.require ?? window.require ?? null;
}

function getNodeRuntime(): NodeRuntime {
  const nodeRequire = getNodeRequire();

  if (!nodeRequire) {
    throw new Error('O Node.js não está disponível neste runtime CEP.');
  }

  return {
    fs: nodeRequire('fs') as FsModule,
    path: nodeRequire('path') as PathModule
  };
}

function getPanelFilePath() {
  const cepExtensionPath = window.__adobe_cep__?.getSystemPath?.('extension');

  if (cepExtensionPath) {
    return decodeURIComponent(cepExtensionPath)
      .replace(/^file:\/\/\/+/, '')
      .replace(/^\/([A-Za-z]:)/, '$1')
      .replace(/\//g, '\\');
  }

  const decodedPath = decodeURIComponent(window.location.pathname);

  if (window.location.protocol !== 'file:') {
    throw new Error('A biblioteca de áudio deve ser aberta dentro do painel CEP compilado.');
  }

  return decodedPath.replace(/^\/([A-Za-z]:)/, '$1').replace(/\//g, '\\');
}

function getBundledAudioDirectory(runtime: NodeRuntime) {
  const panelPath = getPanelFilePath();
  const panelRoot = runtime.path.extname(panelPath) ? runtime.path.dirname(panelPath) : panelPath;

  return runtime.path.join(panelRoot, 'assets', 'sfx');
}

function toFileUrl(absolutePath: string) {
  const normalized = absolutePath.replace(/\\/g, '/');
  const encoded = normalized
    .split('/')
    .map((segment, index) => (index === 0 && /^[A-Za-z]:$/.test(segment) ? segment : encodeURIComponent(segment)))
    .join('/');

  return `file:///${encoded}`;
}

function readDirectory(runtime: NodeRuntime, directory: string): DirectoryContents {
  if (!runtime.fs.existsSync(directory) || !runtime.fs.statSync(directory).isDirectory()) {
    throw new Error(`Pasta de áudio não encontrada: ${directory}`);
  }

  const folders: AudioFolder[] = [];
  const assets: AudioAsset[] = [];

  runtime.fs.readdirSync(directory).forEach((entryName) => {
    const absolutePath = runtime.path.join(directory, entryName);

    try {
      const stats = runtime.fs.statSync(absolutePath);

      if (stats.isDirectory()) {
        folders.push({ name: entryName, absolutePath });
        return;
      }

      const extension = runtime.path.extname(absolutePath).toLowerCase();

      if (stats.isFile() && AUDIO_EXTENSIONS.includes(extension)) {
        assets.push({
          name: runtime.path.basename(absolutePath, extension),
          absolutePath,
          sourceUrl: toFileUrl(absolutePath)
        });
      }
    } catch {
      // Ignora entradas sem permissão de leitura e mantém o restante da pasta disponível.
    }
  });

  folders.sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
  assets.sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));

  return { folders, assets };
}

function createBreadcrumbs(runtime: NodeRuntime, rootDirectory: string, currentDirectory: string): Breadcrumb[] {
  const breadcrumbs: Breadcrumb[] = [
    {
      name: runtime.path.basename(rootDirectory) || rootDirectory,
      absolutePath: rootDirectory
    }
  ];
  const relativePath = runtime.path.relative(rootDirectory, currentDirectory);

  if (!relativePath) {
    return breadcrumbs;
  }

  let accumulatedPath = rootDirectory;

  relativePath.split(/[\\/]/).filter(Boolean).forEach((segment) => {
    accumulatedPath = runtime.path.join(accumulatedPath, segment);
    breadcrumbs.push({ name: segment, absolutePath: accumulatedPath });
  });

  return breadcrumbs;
}

function chooseAudioDirectory(initialPath: string) {
  const dialog = window.cep?.fs;

  if (!dialog) {
    throw new Error('O seletor de pastas está disponível apenas dentro do painel CEP.');
  }

  const result = dialog.showOpenDialogEx
    ? dialog.showOpenDialogEx(false, true, 'Escolha a pasta de áudios', initialPath, [], '', 'Selecionar')
    : dialog.showOpenDialog?.(false, true, 'Escolha a pasta de áudios', initialPath, []);

  return result?.data?.[0] ?? '';
}

export default function AudioLibrary({ isInserting, onInsert }: AudioLibraryProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [rootDirectory, setRootDirectory] = useState('');
  const [currentDirectory, setCurrentDirectory] = useState('');
  const [folders, setFolders] = useState<AudioFolder[]>([]);
  const [assets, setAssets] = useState<AudioAsset[]>([]);
  const [activePath, setActivePath] = useState('');
  const [error, setError] = useState('');

  function openDirectory(directory: string, root = rootDirectory) {
    try {
      const runtime = getNodeRuntime();
      const normalizedRoot = runtime.path.normalize(root || directory);
      const normalizedDirectory = runtime.path.normalize(directory);
      const contents = readDirectory(runtime, normalizedDirectory);

      setRootDirectory(normalizedRoot);
      setCurrentDirectory(normalizedDirectory);
      setFolders(contents.folders);
      setAssets(contents.assets);
      setError('');
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : String(loadError);

      setFolders([]);
      setAssets([]);
      setError(message);
    }
  }

  useEffect(() => {
    try {
      const runtime = getNodeRuntime();
      const storedDirectory = window.localStorage.getItem(AUDIO_ROOT_STORAGE_KEY) || '';
      const bundledDirectory = getBundledAudioDirectory(runtime);
      const initialDirectory = storedDirectory && runtime.fs.existsSync(storedDirectory)
        ? storedDirectory
        : bundledDirectory;

      openDirectory(initialDirectory, initialDirectory);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : String(loadError);
      setError(message);
    }
  }, []);

  const breadcrumbs = useMemo(() => {
    if (!rootDirectory || !currentDirectory) {
      return [];
    }

    try {
      return createBreadcrumbs(getNodeRuntime(), rootDirectory, currentDirectory);
    } catch {
      return [];
    }
  }, [currentDirectory, rootDirectory]);

  function selectDirectory() {
    try {
      const selectedDirectory = chooseAudioDirectory(rootDirectory);

      if (!selectedDirectory) {
        return;
      }

      window.localStorage.setItem(AUDIO_ROOT_STORAGE_KEY, selectedDirectory);
      openDirectory(selectedDirectory, selectedDirectory);
    } catch (selectionError) {
      const message = selectionError instanceof Error ? selectionError.message : String(selectionError);
      setError(message);
    }
  }

  function goToParentDirectory() {
    if (!rootDirectory || !currentDirectory || currentDirectory === rootDirectory) {
      return;
    }

    try {
      const runtime = getNodeRuntime();
      const parentDirectory = runtime.path.dirname(currentDirectory);
      const relativeParent = runtime.path.relative(rootDirectory, parentDirectory);

      openDirectory(relativeParent.startsWith('..') ? rootDirectory : parentDirectory);
    } catch (navigationError) {
      const message = navigationError instanceof Error ? navigationError.message : String(navigationError);
      setError(message);
    }
  }

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
      setError(`Falha na prévia: ${message}`);
    }
  }

  return (
    <section className="rounded-lg border border-funbox-line bg-funbox-panel p-4 shadow-xl shadow-black/20">
      <audio ref={audioRef} onEnded={() => setActivePath('')} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Biblioteca de áudios</h2>
          <p className="mt-1 truncate text-xs text-zinc-500" title={rootDirectory}>
            {rootDirectory || 'Nenhuma pasta selecionada'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => currentDirectory && openDirectory(currentDirectory)}
            disabled={!currentDirectory}
            title="Recarregar pasta"
            aria-label="Recarregar pasta"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-funbox-line text-zinc-200 transition hover:border-funbox-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={selectDirectory}
            className="flex h-9 items-center gap-2 rounded-md bg-funbox-accent px-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300"
          >
            <FolderOpen size={16} aria-hidden="true" />
            Escolher pasta
          </button>
        </div>
      </div>

      {breadcrumbs.length > 0 && (
        <nav aria-label="Caminho da pasta" className="mt-4 flex min-h-9 items-center gap-1 overflow-x-auto border-y border-funbox-line py-2">
          {breadcrumbs.map((breadcrumb, index) => (
            <div key={breadcrumb.absolutePath} className="flex shrink-0 items-center gap-1">
              {index > 0 && <ChevronRight size={14} className="text-zinc-600" aria-hidden="true" />}
              <button
                type="button"
                onClick={() => openDirectory(breadcrumb.absolutePath)}
                className={`max-w-40 truncate px-1 text-xs transition hover:text-funbox-accent ${
                  index === breadcrumbs.length - 1 ? 'font-semibold text-zinc-100' : 'text-zinc-400'
                }`}
                title={breadcrumb.absolutePath}
              >
                {breadcrumb.name}
              </button>
            </div>
          ))}
        </nav>
      )}

      {currentDirectory && (
        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-zinc-500">
          <button
            type="button"
            onClick={goToParentDirectory}
            disabled={currentDirectory === rootDirectory}
            className="flex h-8 items-center gap-2 rounded-md border border-funbox-line px-2 text-zinc-300 transition hover:border-funbox-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Voltar
          </button>
          <span>{folders.length} pastas · {assets.length} áudios</span>
        </div>
      )}

      <div className="mt-3 divide-y divide-funbox-line border-y border-funbox-line">
        {folders.map((folder) => (
          <button
            key={folder.absolutePath}
            type="button"
            onClick={() => openDirectory(folder.absolutePath)}
            className="grid w-full grid-cols-[32px_minmax(0,1fr)_20px] items-center gap-2 py-3 text-left transition hover:text-funbox-accent"
          >
            <Folder size={18} className="text-funbox-accent" aria-hidden="true" />
            <span className="min-w-0 truncate text-sm font-semibold">{folder.name}</span>
            <ChevronRight size={16} className="text-zinc-600" aria-hidden="true" />
          </button>
        ))}

        {assets.map((asset) => {
          const isPlaying = activePath === asset.absolutePath;

          return (
            <div
              key={asset.absolutePath}
              className="grid grid-cols-[36px_minmax(0,1fr)_36px] items-center gap-2 py-2"
            >
              <button
                type="button"
                onClick={() => togglePreview(asset)}
                title={isPlaying ? 'Pausar prévia' : 'Reproduzir prévia'}
                aria-label={isPlaying ? `Pausar ${asset.name}` : `Reproduzir ${asset.name}`}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-funbox-line text-funbox-accent transition hover:border-funbox-accent"
              >
                {isPlaying ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
              </button>

              <p className="min-w-0 truncate text-sm font-semibold text-zinc-100" title={asset.absolutePath}>
                {asset.name}
              </p>

              <button
                type="button"
                onClick={() => onInsert(asset.absolutePath)}
                disabled={isInserting}
                title="Adicionar à timeline"
                aria-label={`Adicionar ${asset.name} à timeline`}
                className="flex h-9 w-9 items-center justify-center rounded-md bg-funbox-accent text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Plus size={17} aria-hidden="true" />
              </button>
            </div>
          );
        })}

        {!error && folders.length === 0 && assets.length === 0 && (
          <p className="py-6 text-center text-sm text-zinc-400">Nenhum áudio nesta pasta.</p>
        )}
      </div>

      {error && (
        <div className="mt-3 border-l-2 border-red-500 bg-red-950/20 px-3 py-2 text-sm text-red-200">{error}</div>
      )}
    </section>
  );
}
