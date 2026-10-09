import { createTrainerCheckAdapter } from './trainer-check-adapter.mjs';

/** Restricted bootstrap. Only trainer checks are enabled until the
 * authoritative Pokemon 5e combat/capture runtime is wired in. */
export function createSafeGmAdapters() {
 return {
  engine:createTrainerCheckAdapter(),
  narrator:async ({outcome}) => outcome.narration
 };
}
