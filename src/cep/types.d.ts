export {};

declare global {
  interface Window {
    CSInterface?: new () => {
      evalScript: (script: string, callback?: (result: string) => void) => void;
    };
    __adobe_cep__?: {
      evalScript: (script: string, callback?: (result: string) => void) => void;
    };
  }
}
