"use client";

import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useState,
} from "react";

const HomeOrderContext = createContext<{
  productType: string | undefined;
  setProductType: Dispatch<SetStateAction<string | undefined>>;
} | null>(null);

export function HomeOrderProvider({ children }: { children: ReactNode }) {
  const [productType, setProductType] = useState<string | undefined>("clothes");
  return (
    <HomeOrderContext.Provider value={{ productType, setProductType }}>
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
