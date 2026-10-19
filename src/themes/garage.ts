import { mountTachometer } from '../interactive/tachometer';
import { mountWindTunnel } from '../interactive/windTunnel';
import type { MountContext } from './index';

export function mount({ stage, hud }: MountContext) {
  const stopTunnel = mountWindTunnel(stage);
  const stopTacho = mountTachometer(hud);
  return () => {
    stopTunnel();
    stopTacho();
  };
}
