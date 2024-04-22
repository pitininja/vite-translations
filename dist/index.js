import fs from 'fs';
import path from 'path';
const locales = ['en', 'fr'];
const defaultTranslations = {
    en: {},
    fr: {}
};
const translationFileNamesMap = new Map(locales.map((l) => [`${l}.json`, l]));
const logPrefix = '[Vite Translation Plugin]';
const jsonFileReader = async (dir, file) => {
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
const readJsonFileRecursively = async (dir) => {
    const entries = await fs.promises.readdir(dir, {
        withFileTypes: true
    });
    const jsonFileEntries = [];
    const dirEntries = [];
    entries.forEach((entry) => {
        if (entry.isFile() && translationFileNamesMap.has(entry.name)) {
            jsonFileEntries.push(entry);
        }
        else if (entry.isDirectory()) {
            dirEntries.push(entry);
        }
    });
    const sourceTranslations = await Promise.all(jsonFileEntries.map((file) => jsonFileReader(dir, file)));
    const readSubDir = await Promise.all(dirEntries.map(({ name }) => readJsonFileRecursively(path.join(dir, name))));
    return [...sourceTranslations, ...readSubDir.flat()];
};
const getSourceTranslationFiles = async (dir) => {
    try {
        await fs.promises.access(dir, fs.constants.R_OK);
        const sourceTranslationFiles = await readJsonFileRecursively(dir);
        return sourceTranslationFiles;
    }
    catch (err) {
        throw new Error(`${logPrefix} Error while reading JSON files: ${err.message}`);
    }
};
const ucfirst = (text) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
const compileTranslationObject = (translationObject, prefix) => {
    if (translationObject && typeof translationObject === 'object') {
        let compiled = {};
        Object.entries(translationObject).forEach(([key, val]) => {
            const prefixedKey = `${prefix ?? ''}${key}`;
            if (typeof val === 'string') {
                compiled[prefixedKey] = {
                    raw: val,
                    ucfirst: ucfirst(val),
                    uppercase: val.toLocaleUpperCase()
                };
            }
            else if (val && typeof val === 'object') {
                compiled = {
                    ...compiled,
                    ...compileTranslationObject(val, `${prefixedKey}.`)
                };
            }
        });
        return compiled;
    }
    throw new Error('JSON file content is not an object');
};
const buildTranslations = (sourceFiles) => {
    const built = {
        ...defaultTranslations
    };
    sourceFiles.forEach(({ path: filePath, locale, content }) => {
        try {
            const obj = JSON.parse(content);
            const compiled = compileTranslationObject(obj);
            built[locale] = {
                ...built[locale],
                ...compiled
            };
        }
        catch (err) {
            throw new Error(`${logPrefix} Error while building translations from file ${filePath} : ${err.message}`);
        }
    });
    return built;
};
const translations = {
    ...defaultTranslations
};
const getTranslation = (locale, key, type, data) => {
    try {
        const localeTranslations = translations[locale];
        if (!localeTranslations) {
            throw new Error(`Translations not found for locale ${locale}`);
        }
        const translation = localeTranslations[key];
        if (!translation) {
            throw new Error(`Translation with key ${key} not found (locale ${locale})`);
        }
        if (data) {
            let replaced = translation[type];
            Object.entries(data).forEach(([name, text]) => {
                replaced = replaced.replaceAll(`{${name}}`, text);
            });
            return replaced;
        }
        return translation[type];
    }
    catch (err) {
        console.error(err.message); // eslint-disable-line no-console
        return '';
    }
};
export default function translationsPlugin({ dir }) {
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
                    const sourceTranslationFiles = await getSourceTranslationFiles(dir);
                    const translationsData = buildTranslations(sourceTranslationFiles);
                    return `
                        const translations = ${JSON.stringify(translationsData)};
                        export const getTranslation = ${getTranslation.toString()};
                        export const locales = ${JSON.stringify(locales)};
                    `;
                }
                return undefined;
            }
            catch (err) {
                throw new Error(`${logPrefix} Error while running plugin : ${err.message}`);
            }
        }
    };
}
//# sourceMappingURL=index.js.map