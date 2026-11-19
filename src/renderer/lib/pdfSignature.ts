import { PDFDocument } from 'pdf-lib'

// Signature placement on the page (PDF points, 1/72 inch).
const SIGNATURE_MAX_WIDTH = 170
const SIGNATURE_MAX_HEIGHT = 60
const MARGIN = 36

/**
 * Embed a signature PNG (data URL) into an existing PDF, placing it at the
 * bottom-right of the last page — the conventional spot for a sign-off —
 * and return the modified PDF bytes.
 */
export async function embedSignatureInPdf(
  pdfBytes: ArrayBuffer,
  signaturePngDataUrl: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const signature = await pdfDoc.embedPng(signaturePngDataUrl)

  const pages = pdfDoc.getPages()
  const page = pages[pages.length - 1]
  const { width: pageWidth } = page.getSize()

  // Fit the signature inside the max box while preserving its aspect ratio.
  const scale = Math.min(
    SIGNATURE_MAX_WIDTH / signature.width,
    SIGNATURE_MAX_HEIGHT / signature.height,
    1
  )
  const drawWidth = signature.width * scale
  const drawHeight = signature.height * scale

  page.drawImage(signature, {
    x: pageWidth - drawWidth - MARGIN,
    y: MARGIN,
    width: drawWidth,
    height: drawHeight,
  })

  return pdfDoc.save()
}

/** Turn "report.pdf" into "report-signed.pdf" for the downloaded file. */
export function signedFileName(fileName: string): string {
  const name = fileName || 'document.pdf'
  const dot = name.lastIndexOf('.')
  if (dot > 0) return `${name.slice(0, dot)}-signed${name.slice(dot)}`
  return `${name}-signed.pdf`
}
