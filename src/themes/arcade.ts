import { mountAchievements } from '../interactive/achievements';
import { ERAS, mountRunner } from '../interactive/runner';
import type { MountContext } from './index';

export function mount({ stage, hud }: MountContext) {
  const achievements = mountAchievements(hud);
  const stopRunner = mountRunner(stage, {
    onStart: () => achievements.unlock('play'),
    onScore: () => achievements.unlock('score'),
    onEra: (index) => {
      if (index >= 4) achievements.unlock('extinction');
      if (index >= ERAS.length - 1) achievements.unlock('future');
    },
  });
  return () => {
    stopRunner();
    achievements.destroy();
  };
}
