// Public surface of the core. Pure TypeScript: no DOM, no Node, no Electron,
// so it runs identically in the app, in tests and in a future CLI.
export * from './math/vec';
export * from './math/mat3';
export * from './solver/frame';
export * from './solver/types';
export * from './solver/vanishing';
export * from './solver/solve';
export * from './solver/project';
export * from './export/camera';
export * from './export/index';
export * from './project/schema';
