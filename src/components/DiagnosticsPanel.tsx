import { useEffect, useState } from 'react';
import { Copy, FolderOpen } from 'lucide-react';
import {
  getLastDiagnosticLogPath,
  readDiagnosticLog,
  revealDiagnosticLog,
  subscribeToDiagnosticLog
} from '../diagnostics/logger';

function copyWithFallback(text: string) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

export default function DiagnosticsPanel() {
  const [logPath, setLogPath] = useState(getLastDiagnosticLogPath);
  const [feedback, setFeedback] = useState('');

  useEffect(() => subscribeToDiagnosticLog(setLogPath), []);

  async function copyLog() {
    const log = readDiagnosticLog();

    if (!log) {
      setFeedback('Nenhum diagnóstico registrado ainda.');
      return;
    }

    try {
      if (window.navigator.clipboard?.writeText) {
        await window.navigator.clipboard.writeText(log);
      } else {
        copyWithFallback(log);
      }
      setFeedback('Log copiado.');
    } catch {
      copyWithFallback(log);
      setFeedback('Log copiado.');
    }
  }

  function revealLog() {
    try {
      revealDiagnosticLog();
      setFeedback('Arquivo de log selecionado no Explorador.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <section className="rounded-lg border border-funbox-line bg-funbox-panel p-4 shadow-xl shadow-black/20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Diagnóstico</h2>
          <p className="mt-1 truncate text-xs text-zinc-500" title={logPath}>
            {logPath || 'O log será criado no próximo comando.'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={copyLog}
            title="Copiar log"
            aria-label="Copiar log"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-funbox-line text-zinc-200 transition hover:border-funbox-accent"
          >
            <Copy size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={revealLog}
            disabled={!logPath}
            className="flex h-9 items-center gap-2 rounded-md bg-funbox-accent px-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FolderOpen size={16} aria-hidden="true" />
            Abrir log
          </button>
        </div>
      </div>
      {feedback && <p className="mt-3 border-l-2 border-zinc-500 px-3 py-2 text-sm text-zinc-300">{feedback}</p>}
    </section>
  );
}
