type EvalScriptCallback = (result: string) => void;

type EvalScriptHost = {
  evalScript: (script: string, callback?: EvalScriptCallback) => void;
};

function getHostBridge(): EvalScriptHost | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (typeof window.CSInterface === 'function') {
    return new window.CSInterface();
  }

  return window.__adobe_cep__ ?? null;
}

export function isCepRuntime(): boolean {
  return getHostBridge() !== null;
}

export function evalHostScript(script: string): Promise<string> {
  const hostBridge = getHostBridge();

  if (!hostBridge) {
    return Promise.resolve(
      JSON.stringify({
        ok: false,
        message: 'CEP indisponivel fora do Premiere Pro. Use o painel instalado para testar host.jsx.',
        script
      })
    );
  }

  return new Promise((resolve, reject) => {
    try {
      hostBridge.evalScript(script, (result) => {
        resolve(result);
      });
    } catch (error) {
      reject(error);
    }
  });
}
