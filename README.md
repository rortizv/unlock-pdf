# Unlock PDF

App para quitar la contraseña de un PDF. Todo ocurre en el navegador: el archivo y la clave no se envían a ningún servidor.

Sitio: [https://rortizv.github.io/unlock-pdf/](https://rortizv.github.io/unlock-pdf/)

1. Suelta o elige un PDF.
2. La app comprueba que sea un PDF y que esté bloqueado.
3. Escribes la contraseña, ves un preview del documento libre y lo descargas.

Hecha con Angular 22. No hay API, base de datos ni backend.

## Requisitos

- Node.js 22 o superior
- npm

## Uso local

```bash
npm install
npm start
```

Abre [http://localhost:4200](http://localhost:4200).

## Build

```bash
npm run build
```

El sitio estático queda en `dist/unlock-pdf/browser`.

Para GitHub Pages:

```bash
npm run build:gh-pages
```

Ese comando usa `--base-href=/unlock-pdf/`.

## Ramas

| Rama | Qué es |
| --- | --- |
| `main` | App con Angular Material 3. Es la que publica GitHub Pages. |
| `dorado` | La misma app con el diseño café/dorado. |

## GitHub Pages

Cada push a `main` dispara `.github/workflows/deploy-github-pages.yml`, que construye `dist/unlock-pdf/browser` y lo publica.

También copia `index.html` a `404.html` para que una recarga no deje la app en blanco.
