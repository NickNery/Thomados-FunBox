import { recordDiagnostic } from '../diagnostics/logger';

export type DownloadFormat = 'video' | 'audio';

export type MediaDownloadOptions = {
  url: string;
  destination: string;
  format: DownloadFormat;
};

export type MediaDownloadEvent = {
  type: 'started' | 'progress' | 'log' | 'done' | 'cancelled' | 'error';
  message: string;
  progress?: number;
  filePath?: string;
};

export type MediaDownloadTask = {
  jobId: string;
  completion: Promise<{ filePath: string }>;
  cancel: () => void;
};

type NodeRequire = (moduleName: string) => unknown;

type FsModule = {
  existsSync: (path: string) => boolean;
  mkdirSync: (path: string, options: { recursive: boolean }) => void;
  statSync: (path: string) => { isDirectory: () => boolean };
};

type PathModule = {
  delimiter: string;
  dirname: (path: string) => string;
  extname: (path: string) => string;
  isAbsolute: (path: string) => boolean;
  join: (...parts: string[]) => string;
  resolve: (...parts: string[]) => string;
};

type ProcessModule = {
  cwd: () => string;
  env: Record<string, string | undefined>;
  platform: string;
};

type DataStream = {
  on: (event: 'data', listener: (chunk: unknown) => void) => void;
};

type SpawnedProcess = {
  stdout?: DataStream;
  stderr?: DataStream;
  kill: () => boolean;
  on: {
    (event: 'error', listener: (error: Error) => void): void;
    (event: 'close', listener: (code: number | null) => void): void;
  };
};

type ChildProcessModule = {
  execFile: (file: string, args: string[], callback?: (error: Error | null) => void) => void;
  spawn: (
    command: string,
    args: string[],
    options: { cwd: string; windowsHide: boolean; shell: false }
  ) => SpawnedProcess;
};

type NodeRuntime = {
  childProcess: ChildProcessModule;
  fs: FsModule;
  path: PathModule;
  process: ProcessModule;
};

const FILE_OUTPUT_PREFIX = '__THOMADOS_FUNBOX_FILE__:';
const MAX_ERROR_OUTPUT = 16000;

function getNodeRequire(): NodeRequire {
  const nodeRequire = window.cep_node?.require ?? window.require;

  if (!nodeRequire) {
    throw new Error('O Node.js não está disponível. Abra a build instalada dentro do Premiere Pro.');
  }

  return nodeRequire;
}

function getNodeRuntime(): NodeRuntime {
  const nodeRequire = getNodeRequire();

  return {
    childProcess: nodeRequire('child_process') as ChildProcessModule,
    fs: nodeRequire('fs') as FsModule,
    path: nodeRequire('path') as PathModule,
    process: nodeRequire('process') as ProcessModule
  };
}

function decodeCepPath(value: string) {
  return decodeURIComponent(value)
    .replace(/^file:\/\/\/+/, '')
    .replace(/^\/([A-Za-z]:)/, '$1')
    .replace(/\//g, '\\');
}

function getExtensionRoot(runtime: NodeRuntime) {
  const extensionPath = window.__adobe_cep__?.getSystemPath?.('extension');

  if (extensionPath) {
    return decodeCepPath(extensionPath);
  }

  if (window.location.protocol === 'file:') {
    const filePath = decodeCepPath(window.location.pathname);
    return runtime.path.extname(filePath) ? runtime.path.dirname(filePath) : filePath;
  }

  return runtime.process.cwd();
}

function firstExistingFile(runtime: NodeRuntime, candidates: string[]) {
  return candidates.find((candidate) => Boolean(candidate) && runtime.fs.existsSync(candidate)) || '';
}

function findExecutableOnPath(runtime: NodeRuntime, executableName: string) {
  const pathValue = runtime.process.env.PATH || runtime.process.env.Path || '';

  for (const folder of pathValue.split(runtime.path.delimiter)) {
    if (!folder) {
      continue;
    }

    const candidate = runtime.path.join(folder.replace(/^"|"$/g, ''), executableName);

    if (runtime.fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return '';
}

function resolveYtdlpBinary(runtime: NodeRuntime) {
  const root = getExtensionRoot(runtime);
  const executableName = runtime.process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
  const localAppData = runtime.process.env.LOCALAPPDATA || '';
  const binary = firstExistingFile(runtime, [
    runtime.path.join(root, 'vendor', 'yt-dlp', executableName),
    runtime.path.join(root, executableName),
    runtime.path.join(runtime.process.cwd(), 'vendor', 'yt-dlp', executableName),
    localAppData ? runtime.path.join(localAppData, 'BaixadorDeVideos3000', 'release', executableName) : '',
    findExecutableOnPath(runtime, executableName)
  ]);

  if (!binary) {
    throw new Error('yt-dlp não foi encontrado na extensão nem no PATH. Reinstale o Thomados FunBox.');
  }

  return binary;
}

function resolveFfmpegBinary(runtime: NodeRuntime) {
  const root = getExtensionRoot(runtime);
  const executableName = runtime.process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';

  return firstExistingFile(runtime, [
    runtime.path.join(root, 'vendor', 'ffmpeg', 'bin', executableName),
    runtime.path.join(root, 'vendor', 'ffmpeg', executableName),
    runtime.path.join(root, executableName),
    findExecutableOnPath(runtime, executableName)
  ]);
}

function validateOptions(runtime: NodeRuntime, options: MediaDownloadOptions) {
  let parsedUrl: URL;
  const url = options.url.trim();
  const destination = options.destination.trim();

  if (!url) {
    throw new Error('Cole um link antes de iniciar o download.');
  }

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('O link informado não é uma URL válida.');
  }

  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    throw new Error('Use um link HTTP ou HTTPS do YouTube, Instagram, Twitter/X ou outro site compatível.');
  }

  if (!destination) {
    throw new Error('Escolha uma pasta de destino.');
  }

  if (!runtime.path.isAbsolute(destination)) {
    throw new Error('A pasta de destino precisa usar um caminho absoluto.');
  }

  runtime.fs.mkdirSync(destination, { recursive: true });

  if (!runtime.fs.statSync(destination).isDirectory()) {
    throw new Error('O destino informado não é uma pasta.');
  }

  return {
    url: parsedUrl.toString(),
    destination: runtime.path.resolve(destination),
    format: options.format === 'audio' ? 'audio' as const : 'video' as const
  };
}

function buildYtdlpArgs(runtime: NodeRuntime, options: ReturnType<typeof validateOptions>, ffmpegBinary: string) {
  const args = ['--newline', '--progress', '--no-playlist', '--no-overwrites', '--trim-filenames', '180'];

  if (runtime.process.platform === 'win32') {
    args.push('--windows-filenames');
  }

  if (ffmpegBinary) {
    args.push('--ffmpeg-location', runtime.path.dirname(ffmpegBinary));
  }

  if (options.format === 'audio') {
    if (!ffmpegBinary) {
      throw new Error('FFmpeg não foi encontrado. Ele é obrigatório para converter o download em MP3.');
    }

    args.push('-x', '--audio-format', 'mp3', '--audio-quality', '0');
  } else if (ffmpegBinary) {
    args.push('-f', 'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]', '--merge-output-format', 'mp4');
  } else {
    args.push('-f', 'b[ext=mp4]/b');
  }

  args.push(
    '--print',
    `after_move:${FILE_OUTPUT_PREFIX}%(filepath)s`,
    '-o',
    runtime.path.join(options.destination, '%(title)s [%(id)s].%(ext)s'),
    options.url
  );

  return args;
}

function parseOutputLine(line: string, notify: (event: MediaDownloadEvent) => void) {
  const trimmed = line.trim();

  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith(FILE_OUTPUT_PREFIX)) {
    return trimmed.slice(FILE_OUTPUT_PREFIX.length).trim();
  }

  const progressMatch = trimmed.match(/\[download\]\s+(\d+(?:\.\d+)?)%/i);

  if (progressMatch) {
    const progress = Math.min(100, Math.max(0, Number(progressMatch[1])));
    notify({ type: 'progress', message: `Baixando: ${progress.toFixed(1)}%`, progress });
  } else {
    notify({ type: 'log', message: trimmed });
  }

  return '';
}

export function startMediaDownload(
  rawOptions: MediaDownloadOptions,
  onEvent: (event: MediaDownloadEvent) => void
): MediaDownloadTask {
  const runtime = getNodeRuntime();
  const options = validateOptions(runtime, rawOptions);
  const ytdlpBinary = resolveYtdlpBinary(runtime);
  const ffmpegBinary = resolveFfmpegBinary(runtime);
  const args = buildYtdlpArgs(runtime, options, ffmpegBinary);
  const jobId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let child: SpawnedProcess;
  let cancelled = false;
  let settled = false;
  let filePath = '';
  let errorOutput = '';
  let stdoutRemainder = '';
  let stderrRemainder = '';

  const notify = (event: MediaDownloadEvent) => {
    try {
      onEvent(event);
    } catch {
      // O processo de download não deve depender da renderização do React.
    }
  };

  const consumeChunk = (chunk: unknown, isError: boolean) => {
    const text = String(chunk);
    let buffer = (isError ? stderrRemainder : stdoutRemainder) + text;
    const lines = buffer.split(/\r?\n/);
    const remainder = lines.pop() || '';

    if (isError) {
      stderrRemainder = remainder;
      errorOutput = `${errorOutput}${text}`.slice(-MAX_ERROR_OUTPUT);
    } else {
      stdoutRemainder = remainder;
    }

    lines.forEach((line) => {
      const outputPath = parseOutputLine(line, notify);
      if (outputPath) {
        filePath = outputPath;
      }
    });
  };

  try {
    child = runtime.childProcess.spawn(ytdlpBinary, args, {
      cwd: options.destination,
      windowsHide: true,
      shell: false
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    recordDiagnostic({ functionName: 'videoDownloader.start', payload: rawOptions, error: message });
    throw error;
  }

  const completion = new Promise<{ filePath: string }>((resolve, reject) => {
    child.stdout?.on('data', (chunk) => consumeChunk(chunk, false));
    child.stderr?.on('data', (chunk) => consumeChunk(chunk, true));

    child.on('error', (error) => {
      if (settled) {
        return;
      }

      settled = true;
      notify({ type: 'error', message: error.message });
      recordDiagnostic({ functionName: 'videoDownloader.process', payload: rawOptions, error: error.message });
      reject(error);
    });

    child.on('close', (code) => {
      if (settled) {
        return;
      }

      settled = true;

      if (stdoutRemainder.trim()) {
        filePath = parseOutputLine(stdoutRemainder, notify) || filePath;
      }

      if (stderrRemainder.trim()) {
        parseOutputLine(stderrRemainder, notify);
      }

      if (cancelled) {
        const error = new Error('Download cancelado.');
        notify({ type: 'cancelled', message: error.message });
        reject(error);
        return;
      }

      if (code === 0) {
        notify({ type: 'done', message: 'Download concluído.', progress: 100, filePath });
        recordDiagnostic({
          functionName: 'videoDownloader.complete',
          payload: { ...rawOptions, ytdlpBinary, ffmpegAvailable: Boolean(ffmpegBinary) },
          response: { filePath }
        });
        resolve({ filePath });
        return;
      }

      const message = errorOutput.trim() || `yt-dlp terminou com código ${code}.`;
      const error = new Error(message);
      notify({ type: 'error', message });
      recordDiagnostic({ functionName: 'videoDownloader.process', payload: rawOptions, error: message });
      reject(error);
    });
  });

  notify({ type: 'started', message: 'Download iniciado.', progress: 0 });
  recordDiagnostic({
    functionName: 'videoDownloader.start',
    payload: { ...rawOptions, ytdlpBinary, ffmpegAvailable: Boolean(ffmpegBinary), args }
  });

  return {
    jobId,
    completion,
    cancel: () => {
      if (!settled) {
        cancelled = true;
        child.kill();
      }
    }
  };
}

export function openDownloadDirectory(directory: string) {
  const runtime = getNodeRuntime();

  if (!directory || !runtime.fs.existsSync(directory)) {
    throw new Error('A pasta de destino não existe.');
  }

  if (runtime.process.platform === 'win32') {
    runtime.childProcess.execFile('explorer.exe', [directory]);
    return;
  }

  runtime.childProcess.execFile('open', [directory]);
}
