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

  const registerOpenHandler = useCallback((fn) => {
    handlerRef.current = fn;
  }, []);

  const openSummary = useCallback((summary) => {
    if (handlerRef.current) handlerRef.current(summary);
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
