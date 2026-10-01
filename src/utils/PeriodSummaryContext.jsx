// utils/PeriodSummaryContext.jsx
import { createContext, useContext, useState, useRef, useCallback } from 'react';

const PeriodSummaryContext = createContext({
  summaries: [],
  setSummaries: () => {},
  openSummary: () => {},
  registerOpenHandler: () => {},
});

export function PeriodSummaryProvider({ children }) {
  const [summaries, setSummaries] = useState([]);
  // Use a ref for the handler — storing functions in useState causes React to call them
  const handlerRef = useRef(null);
  // A summary asked for while no game view was open (the bell, from another
  // page): opened by the next view to register, once the bell has
  // navigated there. See openSummary.
  const pendingRef = useRef(null);

  const registerOpenHandler = useCallback((fn) => {
    handlerRef.current = fn;
    if (fn && pendingRef.current) {
      const summary = pendingRef.current;
      pendingRef.current = null;
      fn(summary);
    }
  }, []);

  // true if a game view opened it now; false if it's held for the next one.
  const openSummary = useCallback((summary) => {
    if (handlerRef.current) { handlerRef.current(summary); return true; }
    pendingRef.current = summary;
    return false;
  }, []);

  return (
    <PeriodSummaryContext.Provider value={{ summaries, setSummaries, openSummary, registerOpenHandler }}>
      {children}
    </PeriodSummaryContext.Provider>
  );
}

export function usePeriodSummaryContext() {
  return useContext(PeriodSummaryContext);
}
