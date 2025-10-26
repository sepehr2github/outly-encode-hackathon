// Binary search helper to find active scene
function findActiveScene(scenes, time) {
  if (!scenes || scenes.length === 0) return 0;

  let lo = 0;
  let hi = scenes.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const scene = scenes[mid];

    if (time < scene.startSec) {
      hi = mid - 1;
    } else if (time >= scene.endSec) {
      lo = mid + 1;
    } else {
      return mid;
    }
  }

  return Math.max(0, Math.min(scenes.length - 1, lo - 1));
}

class SceneScheduler {
  constructor(audioElement, scenePlan, applySceneFn, setCurrentSceneFn) {
    this.audio = audioElement;
    this.scenes = scenePlan.scenes;
    this.applyScene = applySceneFn;
    this.setCurrentScene = setCurrentSceneFn;
    this.timer = null;
    this.driftCheckInterval = null;
    this.currentSceneIndex = -1;
    this.isActive = false;
  }

  async start() {
    this.isActive = true;
    this.audio.currentTime = 0;
    await this.audio.play();

    // Apply first scene immediately
    await this._applyCurrentScene();
    this._scheduleNext();

    // Start drift correction check every second
    this.driftCheckInterval = setInterval(() => this._checkDrift(), 1000);
  }

  pause() {
    this.audio.pause();
    this._clearTimers();
  }

  async resume() {
    await this.audio.play();
    await this._applyCurrentScene();
    this._scheduleNext();

    if (!this.driftCheckInterval) {
      this.driftCheckInterval = setInterval(() => this._checkDrift(), 1000);
    }
  }

  async seek() {
    this._clearTimers();
    await this._applyCurrentScene();
    if (!this.audio.paused) {
      this._scheduleNext();
    }
  }

  stop() {
    this.isActive = false;
    this._clearTimers();
    this.audio.pause();
  }

  async _applyCurrentScene() {
    const idx = findActiveScene(this.scenes, this.audio.currentTime);

    if (idx !== this.currentSceneIndex) {
      this.currentSceneIndex = idx;
      const scene = this.scenes[idx];

      console.log(
        `Applying scene ${idx + 1}/${this.scenes.length}:`,
        scene.prompt.substring(0, 50) + "..."
      );

      await this.applyScene(scene);
      this.setCurrentScene(idx);
    }
  }

  _scheduleNext() {
    if (this.timer) clearTimeout(this.timer);

    const t = this.audio.currentTime;
    const nextIdx = this.currentSceneIndex + 1;

    if (nextIdx < this.scenes.length) {
      const nextScene = this.scenes[nextIdx];
      const delay = Math.max(0, (nextScene.startSec - t) * 1000);

      this.timer = setTimeout(async () => {
        if (this.isActive && !this.audio.paused) {
          await this._applyCurrentScene();
          this._scheduleNext();
        }
      }, delay);
    }
  }

  _checkDrift() {
    if (!this.isActive || this.audio.paused) return;

    const correctIdx = findActiveScene(this.scenes, this.audio.currentTime);

    if (correctIdx !== this.currentSceneIndex) {
      console.log(
        `Drift detected: correcting from scene ${this.currentSceneIndex} to ${correctIdx}`
      );
      this._applyCurrentScene();
      this._scheduleNext();
    }
  }

  _clearTimers() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.driftCheckInterval) {
      clearInterval(this.driftCheckInterval);
      this.driftCheckInterval = null;
    }
  }
}

export default SceneScheduler;
