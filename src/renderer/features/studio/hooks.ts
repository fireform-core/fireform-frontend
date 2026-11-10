import { useState, useRef, useCallback } from 'react'
import { transcribeAudio } from '../../lib/api'

export type SttState = 'idle' | 'recording' | 'paused' | 'transcribing'

export function useSpeechRecording(onTranscribed: (text: string) => void) {
  const [sttState, setSttState] = useState<SttState>('idle')
  const [sttStatus, setSttStatus] = useState('')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const start = useCallback(async () => {
    if (mediaRecorderRef.current) return
    if (!navigator.mediaDevices?.getUserMedia) {
      setSttStatus('Microphone capture not available.')
      return
    }
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setSttStatus('Microphone permission denied.')
      return
    }

    recordedChunksRef.current = []
    const recorder = new MediaRecorder(streamRef.current)

    recorder.addEventListener('dataavailable', e => {
      if (e.data?.size > 0) recordedChunksRef.current.push(e.data)
    })

    recorder.addEventListener('stop', async () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null

      const chunks = recordedChunksRef.current
      const mimeType = recorder.mimeType
      recordedChunksRef.current = []
      mediaRecorderRef.current = null

      const blob = new Blob(chunks, { type: mimeType || 'audio/webm' })
      if (!blob.size) {
        setSttState('idle')
        setSttStatus('Nothing recorded.')
        return
      }

      setSttState('transcribing')
      setSttStatus('Transcribing…')
      try {
        const text = await transcribeAudio(blob)
        onTranscribed(text)
        setSttStatus(text ? 'Transcription added.' : 'No speech detected.')
      } catch (e: unknown) {
        setSttStatus(`Transcription failed: ${(e as Error).message}`)
      }
      setSttState('idle')
    })

    recorder.start()
    mediaRecorderRef.current = recorder
    setSttState('recording')
    setSttStatus('Recording…')
  }, [onTranscribed])

  const togglePause = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (!recorder) return
    if (recorder.state === 'recording') {
      recorder.pause()
      setSttState('paused')
      setSttStatus('Paused.')
    } else if (recorder.state === 'paused') {
      recorder.resume()
      setSttState('recording')
      setSttStatus('Recording…')
    }
  }, [])

  const stop = useCallback(() => {
    if (!mediaRecorderRef.current) return
    setSttStatus('Finishing capture…')
    mediaRecorderRef.current.stop()
  }, [])

  return { sttState, sttStatus, start, togglePause, stop }
}
