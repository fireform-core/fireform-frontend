import { useState, type FormEvent } from 'react'

export interface DigitalSignatureConfiguration {
  certificate: File
  password: string
}

interface SignatureModalProps {
  isOpen: boolean
  value: DigitalSignatureConfiguration | null
  onSave: (configuration: DigitalSignatureConfiguration) => void
  onCancel: () => void
}

export function SignatureModal({ isOpen, value, onSave, onCancel }: SignatureModalProps) {
  const [certificate, setCertificate] = useState<File | null>(value?.certificate ?? null)
  const [password, setPassword] = useState(value?.password ?? '')
  const [error, setError] = useState('')

  if (!isOpen) return null

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!certificate || !/\.(p12|pfx)$/i.test(certificate.name)) {
      setError('Sélectionnez un certificat au format .p12 ou .pfx.')
      return
    }
    if (!password) {
      setError('Saisissez le mot de passe du certificat.')
      return
    }
    onSave({ certificate, password })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="signature-modal-title"
        className="w-full max-w-md rounded-lg border border-zinc-200 bg-white shadow-xl"
      >
        <form onSubmit={handleSubmit}>
          <div className="border-b border-zinc-200 px-5 py-4">
            <h2 id="signature-modal-title" className="text-base font-semibold text-zinc-900">
              Signature numérique
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Configurez le certificat PKCS#12 utilisé pour signer les PDF générés.
            </p>
          </div>

          <div className="space-y-4 px-5 py-4">
            <div>
              <label htmlFor="signature-certificate" className="mb-1.5 block text-sm font-medium text-zinc-700">
                Certificat (.p12 / .pfx)
              </label>
              <input
                id="signature-certificate"
                type="file"
                accept=".p12,.pfx,application/x-pkcs12"
                onChange={event => {
                  setCertificate(event.target.files?.[0] ?? null)
                  setError('')
                }}
                className="block w-full text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200"
              />
              {certificate && (
                <p className="mt-1.5 truncate text-xs text-zinc-500">{certificate.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="signature-password" className="mb-1.5 block text-sm font-medium text-zinc-700">
                Mot de passe du certificat
              </label>
              <input
                id="signature-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={event => {
                  setPassword(event.target.value)
                  setError('')
                }}
                className="h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              />
            </div>

            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          </div>

          <div className="flex justify-end gap-2 border-t border-zinc-200 px-5 py-3">
            <button
              type="button"
              onClick={onCancel}
              className="h-8 rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="h-8 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}