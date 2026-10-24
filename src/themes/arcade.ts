import { mountRunner } from '../interactive/runner';
import type { MountContext } from './index';

export function mount({ stage }: MountContext) {
  return mountRunner(stage);
}
