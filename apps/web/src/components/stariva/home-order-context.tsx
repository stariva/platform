"use client";

import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useState,
} from "react";
import type { PriceSelection } from "@/lib/custom-order/pricing";

type Selection = Partial<PriceSelection>;
const HomeOrderContext = createContext<{
  selection: Selection;
  setSelection: Dispatch<SetStateAction<Selection>>;
} | null>(null);

export function HomeOrderProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<Selection>({
    productType: "clothes",
  });
  return (
    <HomeOrderContext.Provider value={{ selection, setSelection }}>
      {children}
    </HomeOrderContext.Provider>
  );
}

export function useHomeOrder() {
  const context = useContext(HomeOrderContext);
  if (!context)
    throw new Error("Home order components require HomeOrderProvider");
  return context;
}
