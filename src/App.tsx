import React, { useEffect } from 'react';
import Outliner from './components/Outliner';
import { useOutlinerStore } from './store';

const App: React.FC = () => {
  const undo = useOutlinerStore((state) => state.undo);
  const redo = useOutlinerStore((state) => state.redo);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if ((event.metaKey || event.ctrlKey) && (key === 'y')) {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [redo, undo]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Outline</h1>
        <p className="tagline">Fast, local-first outlining with keyboard superpowers.</p>
      </header>
      <main>
        <Outliner />
      </main>
    </div>
  );
};

export default App;
