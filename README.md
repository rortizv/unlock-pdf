# Unlock PDF

App local para quitar la contraseña de un PDF. Todo ocurre en el navegador: el archivo y la clave no se envían a ningún servidor.

1. Suelta o elige un PDF.
2. La app comprueba que sea un PDF y que esté bloqueado.
3. Pides la contraseña, ves un preview del documento libre y lo descargas.

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

El sitio estático queda en `dist/unlock-pdf/browser`. Esa carpeta es lo que hay que publicar.

## Ramas

| Rama | UI |
| --- | --- |
| `dorado` | Diseño propio (tema café/dorado) |
| `angular-material` | Angular Material 3 |

## Publicar

Es una SPA estática. El host solo sirve HTML/JS/CSS; los PDFs siguen procesándose en el cliente.

La opción más simple es **GitHub Pages**. **Azure Blob Storage** también vale, pero si vas a Azure conviene más **Static Web Apps**.

### GitHub Pages

Si el sitio vive en `https://USUARIO.github.io/unlock-pdf/`:

```bash
npx ng build --base-href=/unlock-pdf/
cp dist/unlock-pdf/browser/index.html dist/unlock-pdf/browser/404.html
```

Publica el contenido de `dist/unlock-pdf/browser`. El `404.html` evita que una recarga deje la app en blanco.

En un sitio de usuario (`https://USUARIO.github.io/`) usa `--base-href=/` y no hace falta el prefijo del repo.

### Azure Static Web Apps

Mejor que Blob para un Angular: HTTPS y fallback de SPA incluidos.

- App location: `/`
- Output location: `dist/unlock-pdf/browser`
- API location: vacío

### Azure Blob Storage

1. Activa *Static website* en la cuenta de storage.
2. Sube `dist/unlock-pdf/browser` al contenedor `$web`.
3. Pon `index.html` como documento de índice y de error.

Sirve, pero el HTTPS y el enrutado SPA quedan más toscos que en Pages o Static Web Apps.
