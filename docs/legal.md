# Legal — FireForm Frontend

This document summarizes the legal information, ownership, licensing terms, and attributions for the FireForm frontend application, matching the in-app **Settings → Legal** section.

All statements are sourced directly from repository files and maintainer determinations. Links point to canonical project files and sources.

---

## Ownership & Licensing

The repository license notice states: **Copyright (c) 2026 FireForm**.

The FireForm frontend application is distributed under the terms of the **MIT License**.

- **Application & Assets:** The application and its associated assets have no separate licensing terms; they are covered by the MIT license used across the repository and organization.
- **Terms Summary:** Under the MIT License, permission is granted, free of charge, to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the software and associated assets, subject to retaining the copyright notice and permission notice.
- **Warranty Disclaimer:** The software is provided "as is", without warranty of any kind, express or implied.

📄 [View full MIT License](../LICENSE)

---

## Creators & Contributors

FireForm follows a three-role community governance model as documented in `GOVERNANCE.md`:

| Role | Responsibility | GitHub Permission |
| :--- | :--- | :--- |
| **Owner** | Strategic direction, organization administration | Organization Owner |
| **Maintainer** | Code review, merging pull requests, releases, issue triage | `Maintain` |
| **Contributor** | Code, docs, bug reports, discussions | Fork → Pull Request |

### Current Maintainers

- Marc Vergés Santiago ([@marcvergees](https://github.com/marcvergees))
- Vincent Harkins ([@vharkins1](https://github.com/vharkins1))

> **Note:** Governance roles describe community management and maintenance responsibilities; they do not establish legal intellectual-property ownership.

📄 [View GOVERNANCE.md](../GOVERNANCE.md)
👥 [View all contributors on GitHub](https://github.com/fireform-core/fireform-frontend/graphs/contributors)

---

## Third-Party Dependencies

FireForm bundles open-source libraries. The table below lists the seven direct runtime dependencies specified in `package.json` along with their verified licenses from package metadata:

| Package | License |
| :--- | :--- |
| `class-variance-authority` | Apache-2.0 |
| `clsx` | MIT |
| `lucide-react` | ISC |
| `react` | MIT |
| `react-dom` | MIT |
| `tailwind-merge` | MIT |
| `zustand` | MIT |

> **Scope Note:** This list covers direct runtime dependencies only. It does not include transitive (indirect) dependencies or development dependencies.

📄 [View package.json](../package.json)

---

## Attribution & Credits

FireForm is committed to providing a welcoming, harassment-free community. All participants are expected to follow the project's Code of Conduct.

- **Attribution:** Adapted from the [Contributor Covenant](https://www.contributor-covenant.org), version 2.0, available at [Contributor Covenant 2.0](https://www.contributor-covenant.org/version/2/0/code_of_conduct.html).
- **Guidelines:** Community Impact Guidelines were inspired by Mozilla's code of conduct enforcement ladder.
- **Reporting:** Instances of abusive, harassing, or otherwise unacceptable behavior may be reported to **fireformcore@protonmail.com**.

📄 [View full Code of Conduct](../CODE_OF_CONDUCT.md)

---

## About FireForm

FireForm is a desktop Electron and React application for building and filling structured forms, with PDF preview and template management.

📄 [View README](../README.md)

---

*This document mirrors the user-facing Legal section in the frontend Settings panel (`Settings → Legal`). If either is updated, update both to keep them synchronized.*
