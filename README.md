# FireForm Frontend

> 📄 **Research Paper:** **[Benchmarking Local LLM Extraction Pipelines for Automated Emergency Form Filling: From Monolithic Schemas to Single-Pass Guided Generation](docs/papers/Benchmarking_Local_LLM_Extraction_Pipelines_for_Automated_Emergency_Form_Filling.pdf)**  
> *Marc Vergés Santiago (University of Barcelona), Vincent Harkins (UC Santa Cruz), Abhishek Kumar, Chetan R*  
> 🔗 **Read the Full Paper (PDF):** [`docs/papers/Benchmarking_Local_LLM_Extraction_Pipelines_for_Automated_Emergency_Form_Filling.pdf`](docs/papers/Benchmarking_Local_LLM_Extraction_Pipelines_for_Automated_Emergency_Form_Filling.pdf)  
> *Presents FireForm's offline-first LLM extraction architecture evaluating 5 pipeline designs across Incident Command System (ICS) forms, achieving 99.5% factual data fidelity and 15.4s per-form latency on local hardware with zero cloud dependencies or PII exposure.*

[![Research Paper](https://img.shields.io/badge/Research_Paper-Read_PDF-red.svg)](docs/papers/Benchmarking_Local_LLM_Extraction_Pipelines_for_Automated_Emergency_Form_Filling.pdf)
[![Digital Public Goods](https://img.shields.io/badge/Digital_Public_Good-United_Nations-blue.svg)](https://fireform-core.github.io/FireForm/dpg.html)

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

## 📜 Citation

If you use FireForm or our benchmark methodology in your research, please cite both our research paper and this project:

```bibtex
@article{verges2026benchmarking,
  title={Benchmarking Local LLM Extraction Pipelines for Automated Emergency Form Filling: From Monolithic Schemas to Single-Pass Guided Generation},
  author={Verg{\'e}s Santiago, Marc and Harkins, Vincent and Kumar, Abhishek and R, Chetan},
  year={2026},
  url={docs/papers/Benchmarking_Local_LLM_Extraction_Pipelines_for_Automated_Emergency_Form_Filling.pdf}
}
```

## Contributing

Contributions are welcome. Please follow the repository guidelines and open a pull request for any feature or fix.

## License

See the `LICENSE` file for license terms.
