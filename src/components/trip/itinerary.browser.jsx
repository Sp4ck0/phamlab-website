// Synthetic-only standalone browser check, never imported by the application.
import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route, Link } from 'react-router-dom';
import { DetailedView } from './DetailedView';
import { TripEntryBoundary, ItineraryStart, RouteScrollPolicy } from './TripEntryBoundary';
import '../../styles/globals.css';
export function SyntheticTrip() {
  const [onlyGaps, setOnlyGaps] = useState(false);
  const filterRef = useRef(null);
  const [revision, setRevision] = useState(0);
  const day = { date: '2040-01-02', city: 'Synthetic stop', country: 'US', flights: [], hotels: [], acts: [{ text: 'Synthetic activity '.repeat(80) }], _d: new Date(2040, 0, 2), highlight: 'Synthetic long summary '.repeat(12) };
  const days = [day, { ...day, acts: [], highlight: 'Synthetic gap' }, { ...day, date: '2040-01-03', _d: new Date(2040, 0, 3), note: revision ? 'Synthetic edit' : undefined }];
  const color = { color: '#578', tint: '#dde', label: 'Synthetic leg' };
  return <div className="wrap"><header style={{ padding: '30px 0' }}><h1>Synthetic itinerary developer check</h1><button ref={filterRef} className="btn" aria-pressed={onlyGaps} onClick={() => setOnlyGaps(!onlyGaps)}>{onlyGaps ? 'Show all days' : 'Only gaps'}</button> <Link to="/away">Leave route</Link> <button className="btn" onClick={() => setRevision(revision + 1)}>Synthetic update</button></header><ItineraryStart><DetailedView days={days} legColors={[color, color, color]} weather={{}} groups={[]} ticks={{}} onlyGaps={onlyGaps} onOnlyGapsChange={setOnlyGaps} filterRef={filterRef} onToggle={() => {}} actionItems={[]} actionItemsDone={{}} onToggleActionItem={() => {}} /></ItineraryStart><div style={{ height: 800 }}>Synthetic trailing space</div></div>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><HashRouter><RouteScrollPolicy /><Routes><Route path="/" element={<TripEntryBoundary><SyntheticTrip /></TripEntryBoundary>} /><Route path="/away" element={<div><p>Synthetic away</p><Link to="/">Return</Link></div>} /></Routes></HashRouter></React.StrictMode>);
