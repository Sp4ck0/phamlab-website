import { useState } from 'react';

export function Setup({ onStart }: { onStart: (a: string, b: string) => void }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const ready = a.trim() && b.trim();

  return (
    <main className="setup">
      <div className="setup__card">
        <p className="setup__eyebrow">A board for two</p>
        <h1 className="setup__title">
          Between
          <em>Us</em>
        </h1>
        <p className="setup__lede">
          Somewhere to put the things you tell each other — the good, the asks, and the friction —
          so they get followed through instead of relitigated.
        </p>

        <form
          className="setup__form"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) onStart(a.trim(), b.trim());
          }}
        >
          <label>
            <span className="label">One of you</span>
            <input value={a} onChange={(e) => setA(e.target.value)} placeholder="Name" autoFocus />
          </label>
          <span className="setup__amp">&amp;</span>
          <label>
            <span className="label">The other</span>
            <input value={b} onChange={(e) => setB(e.target.value)} placeholder="Name" />
          </label>
          <button className="btn btn--big" disabled={!ready}>
            Open the board
          </button>
        </form>

        <p className="setup__foot">
          Everything stays in this browser. Nothing is sent anywhere.
        </p>
      </div>
    </main>
  );
}
