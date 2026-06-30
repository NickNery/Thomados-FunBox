type NodeRequire = (moduleName: string) => unknown;

type FsModule = {
  appendFileSync: (path: string, data: string, encoding: string) => void;
  existsSync: (path: string) => boolean;
  mkdirSync: (path: string, options: { recursive: boolean }) => void;
  readFileSync: (path: string, encoding: string) => string;
  renameSync: (oldPath: string, newPath: string) => void;
  statSync: (path: string) => { size: number };
  unlinkSync: (path: string) => void;
};

type PathModule = {
  join: (...parts: string[]) => string;
};

type ProcessModule = {
  env: Record<string, string | undefined>;
};

type ChildProcessModule = {
  execFile: (file: string, args: string[], callback?: (error: Error | null) => void) => void;
};

export type DiagnosticRecord = {
  functionName: string;
  payload?: unknown;
  response?: unknown;
  error?: string;
};

const LAST_LOG_PATH_KEY = 'thomados.funbox.lastDiagnosticLogPath';
const LAST_LOG_TEXT_KEY = 'thomados.funbox.lastDiagnosticLogText';
const LOG_UPDATED_EVENT = 'thomados-funbox:diagnostic-log-updated';
const MAX_LOG_SIZE = 2 * 1024 * 1024;

function getNodeRequire(): NodeRequire | null {
  return window.cep_node?.require ?? window.require ?? null;
}

function decodeCepPath(value: string) {
  return decodeURIComponent(value)
    .replace(/^file:\/\/\/+/, '')
    .replace(/^\/([A-Za-z]:)/, '$1')
    .replace(/\//g, '\\');
}

function resolveLogPath(nodeRequire: NodeRequire) {
  const fs = nodeRequire('fs') as FsModule;
  const path = nodeRequire('path') as PathModule;
  const processModule = nodeRequire('process') as ProcessModule;
  const cepUserData = window.__adobe_cep__?.getSystemPath?.('userData');
  const userDataRoot = cepUserData
    ? decodeCepPath(cepUserData)
    : processModule.env.APPDATA || processModule.env.USERPROFILE || '';

  if (!userDataRoot) {
    throw new Error('Não foi possível localizar a pasta de dados do usuário.');
  }

  const logDirectory = path.join(userDataRoot, 'Thomados FunBox', 'logs');
  fs.mkdirSync(logDirectory, { recursive: true });

  return {
    fs,
    path: path.join(logDirectory, 'thomados-funbox-diagnostics.log'),
    previousPath: path.join(logDirectory, 'thomados-funbox-diagnostics.previous.log')
  };
}

function rotateLog(fs: FsModule, logPath: string, previousPath: string) {
  if (!fs.existsSync(logPath) || fs.statSync(logPath).size < MAX_LOG_SIZE) {
    return;
  }

  if (fs.existsSync(previousPath)) {
    fs.unlinkSync(previousPath);
  }

  fs.renameSync(logPath, previousPath);
}

function notifyLogUpdated(path: string) {
  window.dispatchEvent(new CustomEvent(LOG_UPDATED_EVENT, { detail: { path } }));
}

export function recordDiagnostic(record: DiagnosticRecord) {
  const entry = {
    timestamp: new Date().toISOString(),
    premiereTarget: '26.2.2',
    cepUserAgent: window.navigator.userAgent,
    ...record
  };
  const serialized = JSON.stringify(entry, null, 2);

  try {
    window.localStorage.setItem(LAST_LOG_TEXT_KEY, serialized);
    const nodeRequire = getNodeRequire();

    if (!nodeRequire) {
      notifyLogUpdated('');
      return '';
    }

    const { fs, path, previousPath } = resolveLogPath(nodeRequire);
    rotateLog(fs, path, previousPath);
    fs.appendFileSync(path, `${serialized}\n${'-'.repeat(80)}\n`, 'utf8');
    window.localStorage.setItem(LAST_LOG_PATH_KEY, path);
    notifyLogUpdated(path);
    return path;
  } catch {
    notifyLogUpdated('');
    return '';
  }
}

export function getLastDiagnosticLogPath() {
  return window.localStorage.getItem(LAST_LOG_PATH_KEY) || '';
}

export function readDiagnosticLog() {
  const nodeRequire = getNodeRequire();
  const logPath = getLastDiagnosticLogPath();

  if (!nodeRequire || !logPath) {
    return window.localStorage.getItem(LAST_LOG_TEXT_KEY) || '';
  }

  const fs = nodeRequire('fs') as FsModule;
  return fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
}

export function revealDiagnosticLog() {
  const nodeRequire = getNodeRequire();
  const logPath = getLastDiagnosticLogPath();

  if (!nodeRequire || !logPath) {
    throw new Error('Nenhum arquivo de log foi criado ainda.');
  }

  const childProcess = nodeRequire('child_process') as ChildProcessModule;
  childProcess.execFile('explorer.exe', ['/select,', logPath]);
}

export function subscribeToDiagnosticLog(listener: (path: string) => void) {
  const handler = (event: Event) => {
    listener((event as CustomEvent<{ path?: string }>).detail?.path || getLastDiagnosticLogPath());
  };

  window.addEventListener(LOG_UPDATED_EVENT, handler);
  return () => window.removeEventListener(LOG_UPDATED_EVENT, handler);
}
