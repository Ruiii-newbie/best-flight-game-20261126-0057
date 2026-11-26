// Golden Hour: Island Run — the game loop and the screens.
// Title -> flying -> landed/crashed, with pause, mute, a best score kept in
// localStorage, and ?shot=<scene> for the maker's screenshots: a staged scene
// plays the real rules forward and draws one fixed frame.
import { VIEW } from './config.js';
import { World, STEP, EVENT_CRASHED, EVENT_LANDED, EVENT_OVER, EVENT_RING } from './world.js';
import { createRenderer, SCREEN_COMPLETE, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
canvas.width = VIEW.width;
canvas.height = VIEW.height;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number(params.get('seed') ?? 1) || 1;

const world = new World(seed);
const renderer = createRenderer(canvas);
const input = createInput(canvas);
const audio = createAudio();

let screen = SCREEN_TITLE;
let best = Number(window.localStorage?.getItem('island-run-best') ?? 0) || 0;
let buttons = {};
let last = performance.now();
let acc = 0;

function inside(button, x, y) {
  return button && x >= button.x && y >= button.y && x <= button.x + button.w && y <= button.y + button.h;
}

function startGame() {
  world.reset();
  screen = SCREEN_PLAY;
  audio.ensure();
}

function endRun() {
  const s = world.state;
  if (s.score > best) {
    best = s.score;
    try {
      window.localStorage.setItem('island-run-best', String(best));
    } catch {
      // A browser that blocks storage still plays.
    }
  }
  screen = s.crashed ? SCREEN_OVER : SCREEN_COMPLETE;
}

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const s = world.state;

  if (input.mouse.clicked) {
    input.mouse.clicked = false;
    audio.ensure();
    if (screen === SCREEN_TITLE && inside(buttons.start, input.mouse.x, input.mouse.y)) startGame();
    else if ((screen === SCREEN_OVER || screen === SCREEN_COMPLETE) && inside(buttons.restart, input.mouse.x, input.mouse.y)) startGame();
  }
  if (input.keys.has('Enter') && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_COMPLETE)) {
    startGame();
  }
  if (input.muted !== audio.muted) audio.muted = input.muted;

  if (screen === SCREEN_PLAY) {
    if (input.paused) {
      screen = SCREEN_PAUSED;
    } else {
      input.holdThrottle(world, dt);
      acc += dt;
      let guard = 0;
      while (acc >= STEP && guard < 8) {
        const inputNow = input.read();
        const events = world.step(STEP, inputNow);
        acc -= STEP;
        guard += 1;
        if (events & EVENT_RING) audio.chime();
        if (events & EVENT_LANDED) audio.thud();
        if (events & EVENT_CRASHED) audio.crash();
        if (events & EVENT_OVER) {
          endRun();
          break;
        }
      }
      audio.update(s);
    }
  } else if (screen === SCREEN_PAUSED && !input.paused) {
    screen = SCREEN_PLAY;
  }

  buttons = renderer.draw(world, screen, { best }, s.time + now / 1000);
  requestAnimationFrame(frame);
}

if (shot) {
  // Screenshot mode: stage the scene, draw one fixed frame, stop.
  const staged = stageShot(shot, world);
  renderer.draw(world, staged.screen, { best: staged.best }, staged.t);
  document.title = `Island Run — shot ${shot}`;
} else {
  world.state.message = 'W for throttle — take off, then follow the rings';
  world.state.messageUntil = 6;
  requestAnimationFrame(frame);
}
