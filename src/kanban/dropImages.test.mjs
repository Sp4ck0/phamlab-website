// Images dragged from the desktop onto a card pane: only image files attach.
import assert from 'node:assert/strict';
import { test } from 'node:test';
const { carriesFiles, droppedImages } = await import('./lib.ts');

const file = (name, type) => new File(['x'], name, { type });

test('a drag carrying files is recognised; text or a link is not', () => {
  assert.equal(carriesFiles({ types: ['Files'] }), true);
  assert.equal(carriesFiles({ types: ['text/plain', 'text/uri-list'] }), false);
  assert.equal(carriesFiles(null), false);
});

test('only image files are kept from a drop', () => {
  const files = [file('a.png', 'image/png'), file('b.pdf', 'application/pdf'), file('c.jpg', 'image/jpeg')];
  assert.deepEqual(
    droppedImages({ files }).map((f) => f.name),
    ['a.png', 'c.jpg'],
  );
  assert.deepEqual(droppedImages({ files: [file('notes.txt', 'text/plain')] }), []);
});
