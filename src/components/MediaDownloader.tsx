import { useEffect, useRef, useState } from 'react';
import { Download, FolderOpen, Music, Square, Video } from 'lucide-react';
import { getPremiereProjectDirectory, isCepRuntime } from '../cep/bridge';
import {
  openDownloadDirectory,
  startMediaDownload
} from '../node/videoDownloader';
import type {
  DownloadFormat,
  MediaDownloadEvent,
  MediaDownloadTask
} from '../node/videoDownloader';

function chooseDestinationDirectory(initialPath: string) {
  const dialog = window.cep?.fs;

  if (!dialog) {
    throw new Error('O seletor de pastas está disponível apenas dentro do painel CEP.');
  }

  const result = dialog.showOpenDialogEx
    ? dialog.showOpenDialogEx(false, true, 'Escolha a pasta de destino', initialPath, [], '', 'Selecionar')
    : dialog.showOpenDialog?.(false, true, 'Escolha a pasta de destino', initialPath, []);

  return result?.data?.[0] ?? '';
}

function compactLogMessage(message: string) {
  const trimmed = message.trim();
  return trimmed.length > 500 ? `${trimmed.slice(0, 500)}...` : trimmed;
}

export default function MediaDownloader() {
  const activeTask = useRef<MediaDownloadTask | null>(null);
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState<DownloadFormat>('video');
  const [destination, setDestination] = useState('');
  const [status, setStatus] = useState('Pronto para baixar.');
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isCepRuntime()) {
      setStatus('Abra o painel no Premiere Pro para baixar mídias.');
      return;
    }

    getPremiereProjectDirectory()
      .then((projectDirectory) => {
        setDestination(projectDirectory);
        setStatus(
          projectDirectory
            ? 'Destino carregado a partir do projeto atual.'
            : 'Salve o projeto do Premiere para definir o destino automaticamente.'
        );
      })
      .catch((loadError) => {
        const message = loadError instanceof Error ? loadError.message : String(loadError);
        setError(message);
        setStatus('Não foi possível consultar a pasta do projeto.');
      });
  }, []);

  useEffect(() => () => activeTask.current?.cancel(), []);

  function addLog(message: string) {
    const compactMessage = compactLogMessage(message);

    if (compactMessage) {
      setLogs((current) => [...current.slice(-19), compactMessage]);
    }
  }

  function handleDownloadEvent(event: MediaDownloadEvent) {
    if (typeof event.progress === 'number') {
      setProgress(event.progress);
    }

    if (event.type === 'started') {
      setStatus('Baixando...');
      addLog(event.message);
    } else if (event.type === 'progress') {
      setStatus(event.message);
    } else if (event.type === 'done') {
      setStatus('Download concluído.');
      setError('');
      addLog(event.filePath || event.message);
    } else if (event.type === 'cancelled') {
      setStatus('Download cancelado.');
      addLog(event.message);
    } else if (event.type === 'error') {
      setStatus('Falha no download.');
      setError(compactLogMessage(event.message));
      addLog(event.message);
    } else {
      addLog(event.message);
    }
  }

  async function beginDownload() {
    if (isDownloading) {
      return;
    }

    setError('');
    setLogs([]);
    setProgress(0);

    try {
      const task = startMediaDownload({ url, destination, format }, handleDownloadEvent);
      activeTask.current = task;
      setIsDownloading(true);

      await task.completion;
    } catch (downloadError) {
      const message = downloadError instanceof Error ? downloadError.message : String(downloadError);

      if (message !== 'Download cancelado.') {
        setError(compactLogMessage(message));
        setStatus('Falha no download.');
      }
    } finally {
      activeTask.current = null;
      setIsDownloading(false);
    }
  }

  function cancelDownload() {
    activeTask.current?.cancel();
  }

  function selectDirectory() {
    try {
      const selectedDirectory = chooseDestinationDirectory(destination);

      if (selectedDirectory) {
        setDestination(selectedDirectory);
        setError('');
      }
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : String(selectionError));
    }
  }

  function revealDestination() {
    try {
      openDownloadDirectory(destination);
      setError('');
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : String(openError));
    }
  }

  return (
    <section className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Baixador de mídias</h2>
          <p className="mt-1 text-sm text-zinc-400">YouTube, Instagram e Twitter/X</p>
        </div>
        <button
          type="button"
          onClick={revealDestination}
          disabled={!destination}
          title="Abrir pasta de destino"
          aria-label="Abrir pasta de destino"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-funbox-line text-zinc-200 transition hover:border-funbox-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          <FolderOpen size={17} aria-hidden="true" />
        </button>
      </div>

      <label className="mt-4 grid gap-1 text-sm text-zinc-300">
        <span className="font-semibold text-zinc-100">Link</span>
        <textarea
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          disabled={isDownloading}
          rows={3}
          placeholder="https://..."
          className="min-w-0 resize-none rounded-md border border-funbox-line bg-funbox-background px-3 py-2 text-white outline-none focus:border-funbox-accent disabled:opacity-60"
        />
      </label>

      <fieldset className="mt-3">
        <legend className="text-sm font-semibold text-zinc-100">Formato</legend>
        <div className="mt-1 grid grid-cols-2 overflow-hidden rounded-md border border-funbox-line">
          <button
            type="button"
            onClick={() => setFormat('video')}
            disabled={isDownloading}
            aria-pressed={format === 'video'}
            className={`flex h-10 items-center justify-center gap-2 text-sm font-semibold transition ${
              format === 'video' ? 'bg-funbox-accent text-white' : 'bg-funbox-background text-white hover:bg-funbox-secondary'
            }`}
          >
            <Video size={16} aria-hidden="true" />
            Vídeo MP4
          </button>
          <button
            type="button"
            onClick={() => setFormat('audio')}
            disabled={isDownloading}
            aria-pressed={format === 'audio'}
            className={`flex h-10 items-center justify-center gap-2 border-l border-funbox-line text-sm font-semibold transition ${
              format === 'audio' ? 'bg-funbox-accent text-white' : 'bg-funbox-background text-white hover:bg-funbox-secondary'
            }`}
          >
            <Music size={16} aria-hidden="true" />
            Áudio MP3
          </button>
        </div>
      </fieldset>

      <label className="mt-3 grid gap-1 text-sm text-zinc-300">
        <span className="font-semibold text-zinc-100">Pasta de destino</span>
        <div className="grid grid-cols-[minmax(0,1fr)_40px] gap-2">
          <input
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
            disabled={isDownloading}
            title={destination}
            className="min-w-0 rounded-md border border-funbox-line bg-funbox-background px-3 py-2 text-white outline-none focus:border-funbox-accent disabled:opacity-60"
          />
          <button
            type="button"
            onClick={selectDirectory}
            disabled={isDownloading}
            title="Escolher pasta"
            aria-label="Escolher pasta"
            className="flex h-10 w-10 items-center justify-center rounded-md border border-funbox-line text-funbox-accent transition hover:border-funbox-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FolderOpen size={17} aria-hidden="true" />
          </button>
        </div>
      </label>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={beginDownload}
          disabled={isDownloading || !url.trim() || !destination.trim()}
          className="flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-md bg-funbox-accent px-3 text-sm font-semibold text-white transition hover:bg-funbox-secondary disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Download size={17} aria-hidden="true" />
          {isDownloading ? 'Baixando...' : 'Baixar'}
        </button>
        {isDownloading && (
          <button
            type="button"
            onClick={cancelDownload}
            className="flex h-10 items-center justify-center gap-2 rounded-md border border-funbox-accent px-3 text-sm font-semibold text-white transition hover:bg-funbox-secondary"
          >
            <Square size={14} fill="currentColor" aria-hidden="true" />
            Cancelar
          </button>
        )}
      </div>

      <div className="mt-3" aria-live="polite">
        <div className="h-1.5 overflow-hidden rounded-full bg-funbox-secondary">
          <div
            className="h-full bg-funbox-accent transition-[width] duration-200"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-zinc-400">{status}</p>
      </div>

      {logs.length > 0 && (
        <div className="mt-3 max-h-28 overflow-auto border-y border-funbox-line py-2 text-xs leading-5 text-zinc-500">
          {logs.map((line, index) => <p key={`${index}-${line}`}>{line}</p>)}
        </div>
      )}

      {error && (
        <div className="mt-3 break-words border-l-2 border-funbox-accent bg-funbox-secondary/30 px-3 py-2 text-sm text-white">
          {error}
        </div>
      )}
    </section>
  );
}
