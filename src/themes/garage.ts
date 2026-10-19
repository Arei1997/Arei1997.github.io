import { mountTachometer } from '../interactive/tachometer';
import { mountWindTunnel } from '../interactive/windTunnel';
import type { MountContext } from './index';

export function mount({ stage }: MountContext) {
  const stopTunnel = mountWindTunnel(stage);
  // Docked in the tunnel like a dash instrument, so it never covers page content.
  const stopTacho = mountTachometer(stage.querySelector<HTMLElement>('.tunnel-view')!);
  return () => {
    stopTunnel();
    stopTacho();
  };
}
