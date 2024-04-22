# vite-translations

This Vite plugin compiles JSON translation files into a single translation object with flattened keys.

Source translation files must be named <locale>.json. E.g. `en.json` or `fr.json`.

For example a source translation file like this :

```json
{
    "page": {
        "title": "hey",
        "section": {
            "marco": "polo"
        },
        "anotherSection": {
            "tictac": "toe"
        }
    }
}
```

would be compiled to :


```json
{
    "page.title": "hey",
    "page.section.marco": "polo",
    "page.anotherSection.tictac": "toe"
}
```

## Usage

Configure plugin in Vite configuration :

```typescript
import { defineConfig } from 'vite';
import translations from 'vite-translations';

export default defineConfig({
    plugins: [
        translations({
            dir: 'src/lang'
        })
    ]
});
```

## Options

* `dir` : directory containing JSON source translation files, will be scanned recursively
