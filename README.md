# FireForm Frontend

A desktop Electron + React application for building and filling structured forms, with PDF preview and template management.

## Overview

`fireform-frontend` is the frontend shell for the FireForm app. It provides an Electron-powered UI for:
- building and editing form templates
- filling form data using a form viewer
- previewing documents in PDF format
- managing saved templates and generated output

## Features

- Electron + Vite desktop experience
- React + TypeScript UI
- Template builder for form fields and layouts
- Fill form mode with saved template support
- PDF preview component for document review
- Local storage utilities and app state management via Zustand

## Getting Started

### Prerequisites

- Node.js 18+ or compatible version
- npm

### Install dependencies

```bash
npm install
```

### Run in development mode

```bash
npm run dev
```

This starts `electron-vite` in development mode.

### Build for production

```bash
npm run build
```

### Run a local production preview

```bash
npm run preview
```

### Package distributable

```bash
npm run dist
```

This builds the app and packages it with `electron-builder`.

### Type check

```bash
npm run typecheck
```

## Repository Structure

- `electron.js` — Electron main process bootstrap
- `preload.js` — Electron preload script
- `src/main/` — Electron main process TypeScript sources
- `src/renderer/` — React application sources
- `src/renderer/components/` — shared UI components
- `src/renderer/features/` — feature modules for template building and form filling
- `src/renderer/lib/` — app utilities, API wrappers, constants, and storage helpers
- `src/renderer/store/` — global state management configuration

## Contributing

Contributions are welcome. Please follow the repository guidelines and open a pull request for any feature or fix.

## License

See the `LICENSE` file for license terms.
