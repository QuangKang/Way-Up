import React, { createContext, useContext } from 'react';
import { AppLanguage } from '../db/preferencesService';
import { TRANSLATIONS, TranslationStrings } from './translations';

export interface LanguageContextValue {
  language: AppLanguage;
  t: TranslationStrings;
  setLanguage: (lang: AppLanguage) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  t: TRANSLATIONS.en,
  setLanguage: () => {
    // Default no-op outside provider
  }
});

export interface LanguageProviderProps {
  language: AppLanguage;
  onChangeLanguage: (lang: AppLanguage) => void;
  children: React.ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({
  language,
  onChangeLanguage,
  children
}) => {
  const value: LanguageContextValue = {
    language,
    t: TRANSLATIONS[language],
    setLanguage: onChangeLanguage
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
