"use client";

import { createContext, type ReactNode, useContext, useState } from "react";

const DraftState = createContext<{
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
} | null>(null);

/**
 * Общее состояние черновика для формы и кнопок отправки: пока в форме есть
 * несохранённые правки, отправлять нельзя — уйдёт сохранённая версия.
 */
export function DraftStateProvider({ children }: { children: ReactNode }) {
  const [dirty, setDirty] = useState(false);
  return (
    <DraftState.Provider value={{ dirty, setDirty }}>
      {children}
    </DraftState.Provider>
  );
}

/** null — форма не внутри страницы черновика (новая рассылка). */
export const useDraftState = () => useContext(DraftState);
