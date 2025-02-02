import fs, { type Dirent } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

import type {
    Locale,
    LocaleTranslation,
    LocaleTranslations,
    Translations
} from '@pitininja/vite-translations-client';

const locales: Locale[] = ['en', 'fr'];

const defaultTranslations: Translations = {
    en: {},
    fr: {}
};

const translationFileNamesMap: Map<string, Locale> = new Map(
    locales.map((l) => [`${l}.json`, l])
);

const logPrefix = '[Vite Translation Plugin]';

interface SourceTranslationFileData {
    path: string;
    locale: Locale;
    content: string;
}

const jsonFileReader = async (
    dir: string,
    file: Dirent
): Promise<SourceTranslationFileData> => {
    const locale = translationFileNamesMap.get(file.name);
    const filePath = path.join(dir, file.name);
    if (locale) {
        const content = await fs.promises.readFile(filePath, 'utf8');
        return {
            path: filePath,
            locale,
            content
        };
    }
    throw new Error(`unexpected locale when reading file ${filePath}`);
};

const readJsonFileRecursively = async (
    dir: string
): Promise<SourceTranslationFileData[]> => {
    const entries = await fs.promises.readdir(dir, {
        withFileTypes: true
    });
    const jsonFileEntries: Dirent[] = [];
    const dirEntries: Dirent[] = [];
    for (const entry of entries) {
        if (entry.isFile() && translationFileNamesMap.has(entry.name)) {
            jsonFileEntries.push(entry);
        } else if (entry.isDirectory()) {
            dirEntries.push(entry);
        }
    }
    const sourceTranslations = await Promise.all(
        jsonFileEntries.map((file) => jsonFileReader(dir, file))
    );
    const readSubDir = await Promise.all(
        dirEntries.map(({ name }) =>
            readJsonFileRecursively(path.join(dir, name))
        )
    );
    return [...sourceTranslations, ...readSubDir.flat()];
};

const getSourceTranslationFiles = async (
    dir: string
): Promise<SourceTranslationFileData[]> => {
    try {
        await fs.promises.access(dir, fs.constants.R_OK);
        const sourceTranslationFiles = await readJsonFileRecursively(dir);
        return sourceTranslationFiles;
    } catch (err: unknown) {
        let message = `${logPrefix} Error while reading JSON files`;
        if (err instanceof Error) {
            message = `${message}: ${err.message}`;
        }
        throw new Error(message);
    }
};

const ucfirst = (text: string) =>
    `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

const compileTranslationObject = (
    translationObject: unknown,
    prefix?: string
): LocaleTranslations => {
    if (translationObject && typeof translationObject === 'object') {
        let compiled: LocaleTranslations = {};
        for (const [key, val] of Object.entries(translationObject)) {
            const prefixedKey = `${prefix ?? ''}${key}`;
            if (typeof val === 'string') {
                compiled[prefixedKey] = {
                    raw: val,
                    ucfirst: ucfirst(val),
                    uppercase: val.toLocaleUpperCase()
                };
            } else if (val && typeof val === 'object') {
                compiled = {
                    ...compiled,
                    ...compileTranslationObject(val, `${prefixedKey}.`)
                };
            }
        }
        return compiled;
    }
    throw new Error('JSON file content is not an object');
};

const buildTranslations = (
    sourceFiles: SourceTranslationFileData[]
): Translations => {
    const built: Translations = {
        ...defaultTranslations
    };
    for (const { path: filePath, locale, content } of sourceFiles) {
        try {
            const obj = JSON.parse(content);
            const compiled = compileTranslationObject(obj);
            built[locale] = {
                ...built[locale],
                ...compiled
            };
        } catch (err: unknown) {
            let message = `${logPrefix} Error while building translations from file ${filePath}`;
            if (err instanceof Error) {
                message = `${message}: ${err.message}`;
            }
            throw new Error(message);
        }
    }
    return built;
};

const translations: Translations = {
    ...defaultTranslations
};

const getTranslation = (
    locale: Locale,
    key: string,
    type: keyof LocaleTranslation,
    data?: Record<string, string>
): string => {
    try {
        const localeTranslations = translations[locale];
        if (!localeTranslations) {
            throw new Error(`Translations not found for locale ${locale}`);
        }
        const translation = localeTranslations[key];
        if (!translation) {
            throw new Error(
                `Translation with key ${key} not found (locale ${locale})`
            );
        }
        if (data) {
            let replaced = translation[type];
            for (const [name, text] of Object.entries(data)) {
                replaced = replaced.replaceAll(`{${name}}`, text);
            }
            return replaced;
        }
        return translation[type];
    } catch (err: unknown) {
        console.error(err instanceof Error ? err.message : err);
        return '';
    }
};

const isFileWithinDir = (filePath: string, dirPath: string) => {
    const relative = path.relative(dirPath, filePath);
    return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
};

export default function translationsPlugin({ dir }: { dir: string }): Plugin {
    const absoluteDir = path.resolve(dir);
    const virtualModuleId = '@pitininja/vite-translations-client';
    const resolvedVirtualModuleId = `\0${virtualModuleId}`;
    return {
        name: virtualModuleId,
        resolveId(id) {
            if (id === virtualModuleId) {
                return resolvedVirtualModuleId;
            }
            return undefined;
        },
        async load(id) {
            try {
                if (id === resolvedVirtualModuleId) {
                    const sourceTranslationFiles =
                        await getSourceTranslationFiles(absoluteDir);
                    const translationsData = buildTranslations(
                        sourceTranslationFiles
                    );
                    return `
                        const translations = ${JSON.stringify(translationsData)};
                        export const getTranslation = ${getTranslation.toString()};
                        export const locales = ${JSON.stringify(locales)};
                    `;
                }
                return undefined;
            } catch (err: unknown) {
                let message = `${logPrefix} Error while running plugin`;
                if (err instanceof Error) {
                    message = `${message}: ${err.message}`;
                }
                throw new Error(message);
            }
        },
        handleHotUpdate({ file, server }) {
            const fileName = path.basename(file);
            if (
                isFileWithinDir(file, absoluteDir) &&
                translationFileNamesMap.has(fileName)
            ) {
                const mod = server.moduleGraph.getModuleById(
                    resolvedVirtualModuleId
                );
                if (mod) {
                    server.moduleGraph.invalidateModule(mod);
                    const updatedMod = server.moduleGraph.getModuleById(
                        resolvedVirtualModuleId
                    );
                    if (updatedMod) {
                        return [updatedMod];
                    }
                }
            }
            return undefined;
        }
    };
}
