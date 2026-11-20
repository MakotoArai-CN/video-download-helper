import { afterEach, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { UI } from '../src/ui.ts';

const win = new Window();
Object.assign(globalThis, { window: win, document: win.document });

afterEach(() => {
  document.body.replaceChildren();
});

test('detects an existing panel so a second script instance cannot mount another toolbar entry', () => {
  expect(UI.hasExistingPanel()).toBe(false);

  const host = document.createElement('div');
  host.id = 'bdl-shadow-host';
  const root = host.attachShadow({ mode: 'open' });
  const panel = document.createElement('div');
  panel.id = 'bdl-panel';
  root.append(panel);
  document.body.append(host);

  expect(UI.hasExistingPanel()).toBe(true);
});
