export {};

declare global {
  interface Window {
    require?: (moduleName: string) => unknown;
    cep_node?: {
      require: (moduleName: string) => unknown;
    };
    CSInterface?: new () => {
      evalScript: (script: string, callback?: (result: string) => void) => void;
    };
    __adobe_cep__?: {
      evalScript: (script: string, callback?: (result: string) => void) => void;
      getSystemPath?: (pathType: string) => string;
    };
    cep?: {
      fs?: {
        showOpenDialog?: (
          allowMultipleSelection: boolean,
          chooseDirectory: boolean,
          title: string,
          initialPath: string,
          fileTypes: string[]
        ) => { data?: string[]; err?: number };
        showOpenDialogEx?: (
          allowMultipleSelection: boolean,
          chooseDirectory: boolean,
          title: string,
          initialPath: string,
          fileTypes: string[],
          friendlyFilePrefix?: string,
          prompt?: string
        ) => { data?: string[]; err?: number };
      };
    };
  }
}
