import React from 'react'

// Repository URL confirmed by maintainers (from package.json "repository" field).
const REPO_URL = 'https://github.com/fireform-core/fireform-frontend'

// Direct runtime dependencies from package.json "dependencies".
// License identifiers are verified from each package's installed package.json
// "license" field and bundled LICENSE file.
// This list covers direct runtime dependencies only — transitive (indirect)
// dependencies and development tools are not included.
const RUNTIME_DEPS: Array<{ name: string; license: string }> = [
  { name: 'class-variance-authority', license: 'Apache-2.0' },
  { name: 'clsx',                     license: 'MIT' },
  { name: 'lucide-react',             license: 'ISC' },
  { name: 'react',                    license: 'MIT' },
  { name: 'react-dom',                license: 'MIT' },
  { name: 'tailwind-merge',           license: 'MIT' },
  { name: 'zustand',                  license: 'MIT' },
]

/**
 * Opens an external URL in the system browser.
 *
 * In the renderer, this calls window.open(url, '_blank'). The main process
 * setWindowOpenHandler in src/main/index.ts intercepts the call, validates
 * the destination against approved HTTPS hosts (github.com, contributor-covenant.org),
 * and routes it to shell.openExternal while denying child BrowserWindow creation.
 * Local blob: and localhost/127.0.0.1 PDF pop-outs remain allowed in the app.
 */
function openExternal(url: string) {
  window.open(url, '_blank')
}

function ExternalLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={() => openExternal(href)}
      className="inline-flex items-center gap-1 text-zinc-700 underline underline-offset-2 decoration-zinc-300 hover:text-zinc-900 hover:decoration-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 rounded transition-colors cursor-pointer text-sm"
      aria-label={`Open external link: ${children}`}
    >
      <span>{children}</span>
      <svg
        aria-hidden="true"
        className="w-3 h-3 text-zinc-400 shrink-0"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4.5 1.5H10.5V7.5" />
        <path d="M10.5 1.5L1.5 10.5" />
      </svg>
    </button>
  )
}

function LegalSubheading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">
      {children}
    </h3>
  )
}

function LegalBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-zinc-100 last:border-0 py-5 first:pt-0 last:pb-0">
      {children}
    </div>
  )
}

export function LegalSection() {
  return (
    <section aria-labelledby="legal-section-heading">
      {/* Hidden heading for screen-reader landmark navigation.
          The visible section heading is rendered by SectionHeader in Settings.tsx. */}
      <div id="legal-section-heading" className="sr-only">
        Legal
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl px-5 py-5 shadow-sm space-y-0">

        {/* ── Ownership & Licensing ─────────────────────────────────── */}
        <LegalBlock>
          <LegalSubheading>Ownership &amp; Licensing</LegalSubheading>
          <p className="text-sm text-zinc-700 leading-relaxed">
            The repository license notice states:{' '}
            <strong className="font-semibold text-zinc-800">
              Copyright &copy; 2026 FireForm
            </strong>
            . FireForm is distributed under the terms of the{' '}
            <strong className="font-semibold text-zinc-800">MIT License</strong>.
          </p>
          <p className="text-sm text-zinc-600 leading-relaxed mt-1.5">
            The application and its associated assets have no separate licensing
            terms; they are covered by the MIT license used across the
            repository and organization.
          </p>
          <p className="text-sm text-zinc-500 leading-relaxed mt-1.5">
            Under the MIT License, you are free to use, copy, modify, merge,
            publish, distribute, sublicense, and/or sell copies of the software
            and assets, subject to including the copyright and permission notice.
            The software is provided &ldquo;as is&rdquo;, without warranty of any
            kind.
          </p>
          <p className="mt-2.5">
            <ExternalLink href={`${REPO_URL}/blob/main/LICENSE`}>
              View full MIT License
            </ExternalLink>
          </p>
        </LegalBlock>

        {/* ── Creators & Contributors ──────────────────────────────── */}
        <LegalBlock>
          <LegalSubheading>Creators &amp; Contributors</LegalSubheading>
          <p className="text-sm text-zinc-700 leading-relaxed">
            FireForm follows a three-role governance model:
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-zinc-600">
            <li>
              <strong className="font-medium text-zinc-800">Owner:</strong> Strategic
              direction and organization administration.
            </li>
            <li>
              <strong className="font-medium text-zinc-800">Maintainers:</strong> Code
              review, merging pull requests, releases, and issue triage. Current
              maintainers are Marc Verg&eacute;s Santiago and Vincent Harkins.
            </li>
            <li>
              <strong className="font-medium text-zinc-800">Contributors:</strong> Code,
              documentation, bug reports, and discussions contributed via forks
              and pull requests.
            </li>
          </ul>
          <p className="text-sm text-zinc-500 leading-relaxed mt-2">
            Governance roles describe community responsibilities and project
            maintenance, not legal intellectual-property ownership.
          </p>
          <p className="mt-2.5 flex flex-wrap gap-4">
            <ExternalLink href={`${REPO_URL}/blob/main/GOVERNANCE.md`}>
              View GOVERNANCE.md
            </ExternalLink>
            <ExternalLink href={`${REPO_URL}/graphs/contributors`}>
              View all contributors on GitHub
            </ExternalLink>
          </p>
        </LegalBlock>

        {/* ── Third-Party Dependencies ─────────────────────────────── */}
        <LegalBlock>
          <LegalSubheading>Third-Party Dependencies</LegalSubheading>
          <p className="text-sm text-zinc-700 leading-relaxed">
            FireForm bundles open-source libraries. The table below lists the
            seven direct runtime dependencies specified in{' '}
            <code className="text-xs bg-zinc-100 px-1 py-0.5 rounded font-mono">
              package.json
            </code>{' '}
            and their verified licenses.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table
              className="w-full text-xs border-collapse"
              aria-label="Direct runtime dependencies and verified licenses"
            >
              <thead>
                <tr>
                  <th className="text-left font-semibold text-zinc-500 pb-1.5 pr-6 border-b border-zinc-100">
                    Package
                  </th>
                  <th className="text-left font-semibold text-zinc-500 pb-1.5 border-b border-zinc-100">
                    License
                  </th>
                </tr>
              </thead>
              <tbody>
                {RUNTIME_DEPS.map(dep => (
                  <tr key={dep.name} className="border-b border-zinc-50 last:border-0">
                    <td className="py-1.5 pr-6 font-mono text-zinc-700">{dep.name}</td>
                    <td className="py-1.5 text-zinc-600">{dep.license}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
            This list covers direct runtime dependencies only; it does not
            include transitive (indirect) dependencies or development dependencies.
          </p>
          <p className="mt-2.5">
            <ExternalLink href={`${REPO_URL}/blob/main/package.json`}>
              View package.json
            </ExternalLink>
          </p>
        </LegalBlock>

        {/* ── Attribution & Credits ─────────────────────────────────── */}
        <LegalBlock>
          <LegalSubheading>Attribution &amp; Credits</LegalSubheading>
          <p className="text-sm text-zinc-700 leading-relaxed">
            FireForm is committed to providing a welcoming, harassment-free
            community for everyone. All participants are expected to adhere to
            the project&rsquo;s Code of Conduct.
          </p>
          <p className="text-sm text-zinc-600 leading-relaxed mt-1.5">
            The Code of Conduct is adapted from the{' '}
            <ExternalLink href="https://www.contributor-covenant.org/version/2/0/code_of_conduct.html">
              Contributor Covenant, version 2.0
            </ExternalLink>
            . Community Impact Guidelines were inspired by Mozilla&rsquo;s code
            of conduct enforcement ladder.
          </p>
          <p className="text-sm text-zinc-500 leading-relaxed mt-1.5">
            Instances of unacceptable behavior may be reported to{' '}
            <span className="font-medium text-zinc-800">
              fireformcore@protonmail.com
            </span>
            .
          </p>
          <p className="mt-2.5">
            <ExternalLink href={`${REPO_URL}/blob/main/CODE_OF_CONDUCT.md`}>
              View full Code of Conduct
            </ExternalLink>
          </p>
        </LegalBlock>

        {/* ── About FireForm ────────────────────────────────────────── */}
        <LegalBlock>
          <LegalSubheading>About FireForm</LegalSubheading>
          <p className="text-sm text-zinc-700 leading-relaxed">
            FireForm is a desktop Electron and React application for building
            and filling structured forms, with PDF preview and template
            management.
          </p>
          <p className="mt-2.5">
            <ExternalLink href={`${REPO_URL}/blob/main/README.md`}>
              View README
            </ExternalLink>
          </p>
        </LegalBlock>

      </div>
    </section>
  )
}
