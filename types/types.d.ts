declare module '@pitininja/vite-translations' {
    export default function translationsPlugin({
        dir
    }: {
        dir: string;
    }): Plugin;
}

declare module '@pitininja/vite-translations-client' {
    export type Locale = 'en' | 'fr';
    export type TranslationType = 'raw' | 'ucfirst' | 'uppercase';
    export type LocaleTranslation = Record<TranslationType, string>;
    export type LocaleTranslations = Record<string, LocaleTranslation>;
    export type Translations = Record<Locale, LocaleTranslations>;
    export const locales: Locale[];
    export function getTranslation(
        locale: Locale,
        key: string,
        type: keyof LocaleTranslation,
        data?: Record<string, string>
    ): string;
}
