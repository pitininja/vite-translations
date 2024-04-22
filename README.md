# vite-translations

This Vite plugin compiles translation files and offers utility functions to get translation texts in the source code.

## Install

```shell
npm i -D @pitininja/vite-translations
```

## Usage

Setup the Vite plugin :

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import translations from '@pitininja/vite-translations';

export default defineConfig({
    plugins: [
        translations({
            dir: './src/lang' // directory containing source translation files (required)
        })
    ]
});
```

Use the client in source code :

```tsx
import { locales, getTranslation } from '@pitininja/vite-translations-client';

const MyComponent = () => (
    <div>
        <h1>{getTranslation('en', 'page.title', 'ucfirst')}</h1>
        <p>{getTranslation('en', 'page.anotherSection.tic', 'raw', {
            someVariable: 'toe'
        })}</p>
        <p>Available locales : {locales.join(', ')}</p>
    </div>
);
```

Will result in :

```html
<div>
    <h1>My title</h1>
    <p>tac toe</p>
    <p>Available locales : en, fr</p>
</div>
```

## Translation files

Translation files are JSON files that can take any form. The only requirement is that it must only contain object. Objects can be nested at will.

> All translation files found in the provided directory are compiled into a single translation object with flattened keys so it's more performant to process.

Translation files must be named `<locale>.json`. E.g. `en.json` or `fr.json`.

There can be multiple translation files, they will all be merged together.

### Example

Let's say we have these translation files :

> `src/lang/en.json`

```json
{
    "app": {
        "name": "my app"
    }
}
```

> `src/lang/home/en.json`

```json
{
    "page": {
        "home": {
            "title": "home page",
            "welcome": "welcome {user} !"
        }
    }
}
```

> `src/lang/profile/en.json`

```json
{
    "page": {
        "profile": {
            "title": "profile page",
            "form": {
                "username": "your name",
                "password": "your password"
            }
        }
    }
}
```

These translation files would be compiles as :

```json
{
    "app.name": "my app",
    "page.home.title": "home page",
    "page.home.welcome": "welcome {username} !",
    "page.profile.title": "profile page",
    "page.profile.form.username": "your name",
    "page.profile.form.password": "your password"
}
```

Therefore to display the welcome home text we would use :

```typescript
getTranslation('en', 'page.home.welcome', 'ucfirst', {
    username: 'Mary'
})
```
