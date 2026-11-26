// Keyboard and mouse input for Island Run.
// Keyboard flies the plane; the mouse works the menus and the pause button.
// Arrow Left/Right (or A/D) bank and turn, Arrow Up/Down pitch the nose,
// W/S hold the throttle up and down, Shift boosts, Space brakes.
export function createInput(canvas) {
  const keys = new Set();
  const input = {
    keys,
    mouse: { x: 0, y: 0, down: false, clicked: false },
    paused: false,
    muted: false,
    /** The flight control vector for this frame. */
    read() {
      const left = keys.has('ArrowLeft') || keys.has('a') || keys.has('A');
      const right = keys.has('ArrowRight') || keys.has('d') || keys.has('D');
      const up = keys.has('ArrowUp');
      const down = keys.has('ArrowDown');
      return {
        turn: (right ? 1 : 0) - (left ? 1 : 0),
        pitch: (up ? 1 : 0) - (down ? 1 : 0),
        throttle: 0, // throttle is held, not momentary: see holdThrottle
        boost: keys.has('Shift'),
        brake: keys.has(' ') || keys.has('b') || keys.has('B'),
      };
    },
    /** Throttle is a held setting: W/S nudge it up and down. */
    holdThrottle(world, dt) {
      const s = world.state;
      const up = keys.has('w') || keys.has('W');
      const down = keys.has('s') || keys.has('S');
      if (up) s.throttle = Math.min(1, s.throttle + dt * 0.55);
      if (down) s.throttle = Math.max(0, s.throttle - dt * 0.55);
    },
  };

  const onKey = (event) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) {
      event.preventDefault();
    }
    if (event.type === 'keydown') {
      keys.add(event.key);
      if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') input.paused = !input.paused;
      if (event.key === 'm' || event.key === 'M') input.muted = !input.muted;
    } else {
      keys.delete(event.key);
    }
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouse.x = (event.clientX - rect.left) * (canvas.width / rect.width);
    input.mouse.y = (event.clientY - rect.top) * (canvas.height / rect.height);
  });
  canvas.addEventListener('mousedown', (event) => {
    input.mouse.down = true;
    input.mouse.clicked = true;
    const rect = canvas.getBoundingClientRect();
    input.mouse.x = (event.clientX - rect.left) * (canvas.width / rect.width);
    input.mouse.y = (event.clientY - rect.top) * (canvas.height / rect.height);
  });
  window.addEventListener('mouseup', () => {
    input.mouse.down = false;
  });
  return input;
}
