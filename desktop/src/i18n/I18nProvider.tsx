import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { messages, type Locale, type MessageTree } from "./messages";

export type { Locale };

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: MessageTree;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function detectLocale(): Locale {
  if (typeof navigator === "undefined") {
    return "en";
  }
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => detectLocale());

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale: setLocaleState,
      t: messages[locale],
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
