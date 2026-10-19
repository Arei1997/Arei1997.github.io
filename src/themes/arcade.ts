import { mountAchievements } from '../interactive/achievements';
import { mountRunner } from '../interactive/runner';
import type { MountContext } from './index';

export function mount({ stage, hud }: MountContext) {
  const achievements = mountAchievements(hud);
  const stopRunner = mountRunner(stage, {
    onStart: () => achievements.unlock('play'),
    onScore: () => achievements.unlock('score'),
  });
  return () => {
    stopRunner();
    achievements.destroy();
  };
}
