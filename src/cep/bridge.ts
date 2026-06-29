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

export type TextAnimationType = 'pop-in' | 'slide-up' | 'fade-scale' | 'typewriter' | 'custom';

export type TextAnimationRecipe = {
  scaleStart?: number;
  scaleOvershoot?: number;
  positionYOffset?: number;
  opacityStart?: number;
  reveal?: boolean;
};

export type TextAnimationPayload = {
  type: TextAnimationType;
  duration: number;
  target?: 'selection';
  presetName?: string;
  recipe?: TextAnimationRecipe;
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
  target?: 'selection';
  presetName?: string;
  clipName?: string;
  animatedProperties?: string[];
  filePath?: string;
  projectItemName?: string;
  audioTrack?: number;
  imported?: boolean;
  inserted?: boolean;
  warnings?: string[];
};

export type RuntimeInfoResponse = HostApplyResponse & {
  compatible?: boolean;
  expectedVersion?: string;
  appVersion?: string;
  appName?: string;
  projectName?: string;
  sequenceName?: string;
  selectedClips?: number;
  cepUserAgent?: string;
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
    const timeout = window.setTimeout(() => {
      reject(new Error('O Premiere nao respondeu ao comando JSX em 15 segundos.'));
    }, 15000);

    try {
      hostBridge.evalScript(script, (result) => {
        window.clearTimeout(timeout);

        if (!result || result === 'EvalScript error.') {
          reject(new Error('O host JSX retornou EvalScript error. Verifique a instalacao e o host.jsx.'));
          return;
        }

        resolve(result);
      });
    } catch (error) {
      window.clearTimeout(timeout);
      reject(error);
    }
  });
}

function toExtendScriptLiteral(value: unknown) {
  return JSON.stringify(value)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

async function invokeHost<T>(functionName: string, payload?: unknown): Promise<T> {
  const argument = payload === undefined ? '' : toExtendScriptLiteral(payload);
  const rawResponse = await evalHostScript(`${functionName}(${argument})`);

  try {
    return JSON.parse(rawResponse) as T;
  } catch {
    throw new Error(`Resposta invalida de ${functionName}: ${rawResponse}`);
  }
}

export async function getRuntimeInfo(): Promise<RuntimeInfoResponse> {
  const response = await invokeHost<RuntimeInfoResponse>('thomadosFunBox_getRuntimeInfo');

  return {
    ...response,
    cepUserAgent: window.navigator.userAgent
  };
}

export async function applyTemporalEaseToSelection(payload: TemporalEasePayload): Promise<HostApplyResponse> {
  return invokeHost<HostApplyResponse>('thomadosFunBox_applyTemporalEase', payload);
}

export async function bakeCurveToSelection(payload: BakeCurvePayload): Promise<HostApplyResponse> {
  return invokeHost<HostApplyResponse>('thomadosFunBox_bakeCurve', payload);
}

export async function applyTextAnimation(payload: TextAnimationPayload): Promise<HostApplyResponse> {
  return invokeHost<HostApplyResponse>('thomadosFunBox_applyTextAnimation', payload);
}

export async function importAndInsertAudio(absoluteFilePath: string): Promise<HostApplyResponse> {
  return invokeHost<HostApplyResponse>('thomadosFunBox_importAndInsertAudio', absoluteFilePath);
}
