import { recordDiagnostic } from '../diagnostics/logger';

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

export type CapturedKeyframe = {
  offsetSeconds: number;
  value: unknown;
  interpolationType?: number | null;
  sampled?: boolean;
};

export type CapturedAnimationProperty = {
  componentMatchName: string;
  componentDisplayName: string;
  componentIndex: number;
  componentRole?: 'motion' | 'vector-motion' | 'opacity' | 'other';
  propertyDisplayName: string;
  propertyIndex: number;
  semanticKey?: 'scale' | 'position' | 'opacity' | 'rotation' | 'anchor-point' | '';
  sourceTimeBasis?: 'sequence' | 'clip-local';
  sourceKeyframeCount?: number;
  sampledKeyframeCount?: number;
  curveSampled?: boolean;
  keyframes: CapturedKeyframe[];
};

export type CapturedTextAnimation = {
  formatVersion?: number;
  sourceClipName: string;
  sourceSequenceZeroPointSeconds?: number;
  sourceClipStartSeconds?: number;
  sourceHostStartSeconds?: number;
  sourceClipDurationSeconds?: number;
  durationSeconds: number;
  timeBasis?: 'clip' | 'clip-offset';
  properties: CapturedAnimationProperty[];
};

export type CapturedTextAnimationPreset = {
  id: string;
  name: string;
  createdAt: string;
  animation: CapturedTextAnimation;
};

export type CaptureTextAnimationResponse = HostApplyResponse & {
  animation?: CapturedTextAnimation;
};

export type ApplyCapturedTextAnimationPayload = {
  presetName: string;
  animation: CapturedTextAnimation;
};

export type HostApplyResponse = {
  ok: boolean;
  message?: string;
  applied?: number;
  clips?: number;
  components?: number;
  properties?: number;
  keys?: number;
  sourceKeys?: number;
  sampledKeys?: number;
  fallbacks?: number;
  temporalEaseApplied?: number;
  interpolationApplied?: number;
  selectionLimitedProperties?: number;
  bakedKeys?: number;
  intervals?: number;
  removedKeys?: number;
  unsupportedProperties?: number;
  linearizedKeys?: number;
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
  diagnostics?: string[];
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
        message: 'CEP indisponível fora do Premiere Pro. Use o painel instalado para testar o host.jsx.',
        script
      })
    );
  }

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error('O Premiere não respondeu ao comando JSX em 15 segundos.'));
    }, 15000);

    try {
      hostBridge.evalScript(script, (result) => {
        window.clearTimeout(timeout);

        if (!result || result === 'EvalScript error.') {
          reject(new Error('O host JSX retornou EvalScript error. Verifique a instalação e o host.jsx.'));
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

  try {
    const rawResponse = await evalHostScript(`${functionName}(${argument})`);
    const response = JSON.parse(rawResponse) as T;
    recordDiagnostic({ functionName, payload, response });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    recordDiagnostic({ functionName, payload, error: message });
    throw new Error(`Falha em ${functionName}: ${message}`);
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

export async function captureTextAnimationFromSelection(): Promise<CaptureTextAnimationResponse> {
  return invokeHost<CaptureTextAnimationResponse>('thomadosFunBox_captureTextAnimation');
}

export async function applyCapturedTextAnimation(
  payload: ApplyCapturedTextAnimationPayload
): Promise<HostApplyResponse> {
  return invokeHost<HostApplyResponse>('thomadosFunBox_applyCapturedTextAnimation', payload);
}

export async function importAndInsertAudio(absoluteFilePath: string): Promise<HostApplyResponse> {
  return invokeHost<HostApplyResponse>('thomadosFunBox_importAndInsertAudio', absoluteFilePath);
}
