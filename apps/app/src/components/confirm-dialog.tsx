"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Field,
  FieldLabel,
  Input,
} from "@stariva/ui";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useId,
  useRef,
  useState,
} from "react";

export type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Поле, которое нужно заполнить, чтобы кнопка подтверждения стала активной. */
  input?: {
    label: string;
    placeholder?: string;
    matches: (value: string) => boolean;
  };
};

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/** Замена window.confirm/prompt на AlertDialog: `if (!(await confirm({...}))) return;` */
export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error("useConfirm нужно вызывать внутри <ConfirmProvider>");
  }
  return confirm;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  // Держим опции после закрытия, чтобы текст не пропадал во время анимации.
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [value, setValue] = useState("");
  const resolver = useRef<((result: boolean) => void) | null>(null);
  const inputId = useId();

  const settle = useCallback((result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setOpen(false);
  }, []);

  const confirm = useCallback<Confirm>((next) => {
    resolver.current?.(false);
    setOptions(next);
    setValue("");
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const canConfirm = !options?.input || options.input.matches(value);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) settle(false);
        }}
      >
        {options && (
          <AlertDialogContent>
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (canConfirm) settle(true);
              }}
            >
              <AlertDialogHeader>
                <AlertDialogTitle>{options.title}</AlertDialogTitle>
                {options.description && (
                  <AlertDialogDescription
                    render={<div />}
                    className="space-y-2"
                  >
                    {options.description}
                  </AlertDialogDescription>
                )}
              </AlertDialogHeader>
              {options.input && (
                <Field>
                  <FieldLabel htmlFor={inputId}>
                    {options.input.label}
                  </FieldLabel>
                  <Input
                    id={inputId}
                    autoFocus
                    autoComplete="off"
                    placeholder={options.input.placeholder}
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                  />
                </Field>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel type="button">
                  {options.cancelLabel ?? "Отмена"}
                </AlertDialogCancel>
                <AlertDialogAction
                  type="submit"
                  variant={options.destructive ? "destructive" : "default"}
                  disabled={!canConfirm}
                >
                  {options.confirmLabel ?? "Подтвердить"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}
