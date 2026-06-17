type EvalScriptCallback = (result: string) => void;

type EvalScriptHost = {
  evalScript: (script: string, callback?: EvalScriptCallback) => void;
};

export type TemporalEaseValues = {
  speed: number;
  influence: number;
};

export type BezierPoint = {
  x: number;
  y: number;
};

export type TemporalEasePayload = {
  curve: {
    outgoing: BezierPoint;
    incoming: BezierPoint;
  };
  ease: {
    outgoing: TemporalEaseValues;
    incoming: TemporalEaseValues;
  };
  metadata?: {
    presetName?: string;
    createdAt?: string;
  };
};

export type BakeCurvePayload = TemporalEasePayload & {
  bake: {
    samples: number;
    replaceInteriorKeys: boolean;
  };
};

export type TextAnimationType = 'pop-in' | 'slide-up' | 'fade-scale' | 'typewriter';

export type TextAnimationPayload = {
  type: TextAnimationType;
  duration: number;
  text?: string;
  videoTrackOffset?: number;
};

export type HostApplyResponse = {
  ok: boolean;
  message?: string;
  applied?: number;
  clips?: number;
  components?: number;
  properties?: number;
  keys?: number;
  fallbacks?: number;
  temporalEaseApplied?: number;
  interpolationApplied?: number;
  selectionLimitedProperties?: number;
  bakedKeys?: number;
  intervals?: number;
  removedKeys?: number;
  unsupportedProperties?: number;
  linearizedKeys?: number;
  animationType?: TextAnimationType;
  mogrtPath?: string;
  trackIndex?: number;
  clipName?: string;
  animatedProperties?: string[];
  warnings?: string[];
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

function toExtendScriptLiteral(value: unknown) {
  return JSON.stringify(value)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export async function applyTemporalEaseToSelection(payload: TemporalEasePayload): Promise<HostApplyResponse> {
  const script = `thomadosFunBox_applyTemporalEase(${toExtendScriptLiteral(payload)})`;
  const rawResponse = await evalHostScript(script);

  try {
    return JSON.parse(rawResponse) as HostApplyResponse;
  } catch {
    return {
      ok: false,
      message: rawResponse || 'Resposta invalida do host JSX.',
      warnings: ['Nao foi possivel interpretar a resposta como JSON.']
    };
  }
}

export async function bakeCurveToSelection(payload: BakeCurvePayload): Promise<HostApplyResponse> {
  const script = `thomadosFunBox_bakeCurve(${toExtendScriptLiteral(payload)})`;
  const rawResponse = await evalHostScript(script);

  try {
    return JSON.parse(rawResponse) as HostApplyResponse;
  } catch {
    return {
      ok: false,
      message: rawResponse || 'Resposta invalida do host JSX.',
      warnings: ['Nao foi possivel interpretar a resposta como JSON.']
    };
  }
}

export async function applyTextAnimation(payload: TextAnimationPayload): Promise<HostApplyResponse> {
  const script = `thomadosFunBox_applyTextAnimation(${toExtendScriptLiteral(payload)})`;
  const rawResponse = await evalHostScript(script);

  try {
    return JSON.parse(rawResponse) as HostApplyResponse;
  } catch {
    return {
      ok: false,
      message: rawResponse || 'Resposta invalida do host JSX.',
      warnings: ['Nao foi possivel interpretar a resposta como JSON.']
    };
  }
}
