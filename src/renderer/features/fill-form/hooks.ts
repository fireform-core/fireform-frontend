import { useState, useRef, useCallback, useEffect } from 'react'
import { getTranscribeWsUrl, transcribeAudio } from '../../lib/api'

export type SttState = 'idle' | 'recording' | 'paused' | 'transcribing'

interface UseSpeechRecordingOptions {
  initialTranslate?: boolean
}

function downsampleAndConvertToPCM(
  inputBuffer: Float32Array,
  inputSampleRate: number,
  outputSampleRate = 16000
): Int16Array {
  if (inputSampleRate === outputSampleRate) {
    const output = new Int16Array(inputBuffer.length)
    for (let i = 0; i < inputBuffer.length; i++) {
      const s = Math.max(-1, Math.min(1, inputBuffer[i] ?? 0))
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    return output
  }

  const ratio = inputSampleRate / outputSampleRate
  const outputLength = Math.round(inputBuffer.length / ratio)
  const output = new Int16Array(outputLength)
  for (let i = 0; i < outputLength; i++) {
    const index = i * ratio
    const leftIndex = Math.floor(index)
    const rightIndex = Math.min(leftIndex + 1, inputBuffer.length - 1)
    const fraction = index - leftIndex
    const leftVal = inputBuffer[leftIndex] ?? 0
    const rightVal = inputBuffer[rightIndex] ?? 0
    const sample = leftVal * (1 - fraction) + rightVal * fraction
    const s = Math.max(-1, Math.min(1, sample))
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return output
}

export function useSpeechRecording(
  onTranscribed: (text: string, translation?: string) => void,
  options?: UseSpeechRecordingOptions
) {
  const [sttState, setSttState] = useState<SttState>('idle')
  const [sttStatus, setSttStatus] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [interimTranslation, setInterimTranslation] = useState('')
  const [liveTranslateEnabled, setLiveTranslateEnabled] = useState(options?.initialTranslate ?? true)

  const liveTranslateRef = useRef(liveTranslateEnabled)
  useEffect(() => {
    liveTranslateRef.current = liveTranslateEnabled
  }, [liveTranslateEnabled])

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const isPausedRef = useRef(false)
  const isStreamingRef = useRef(false)
  const finalReceivedRef = useRef(false)

  const cleanupAudio = useCallback(() => {
    if (processorRef.current) {
      try { processorRef.current.disconnect() } catch { /* ignore */ }
      processorRef.current = null
    }
    if (audioContextRef.current) {
      try { void audioContextRef.current.close() } catch { /* ignore */ }
      audioContextRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (wsRef.current) {
      try { wsRef.current.close() } catch { /* ignore */ }
      wsRef.current = null
    }
  }, [])

  const start = useCallback(async () => {
    if (mediaRecorderRef.current || audioContextRef.current) return
    if (!navigator.mediaDevices?.getUserMedia) {
      setSttStatus('Microphone capture not available.')
      return
    }

    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })
    } catch {
      setSttStatus('Microphone permission denied.')
      return
    }

    setInterimTranscript('')
    setInterimTranslation('')
    recordedChunksRef.current = []
    finalReceivedRef.current = false
    isPausedRef.current = false
    isStreamingRef.current = false

    // 1. Setup fallback MediaRecorder (for batch transcription if WS unavailable)
    try {
      const recorder = new MediaRecorder(streamRef.current)
      recorder.addEventListener('dataavailable', e => {
        if (e.data?.size > 0) recordedChunksRef.current.push(e.data)
      })
      recorder.start(250)
      mediaRecorderRef.current = recorder
    } catch { /* MediaRecorder unavailable */ }

    // 2. Open WebSocket for live streaming
    const wsUrl = getTranscribeWsUrl({ translate: liveTranslateRef.current })
    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => { isStreamingRef.current = true }

      ws.onmessage = event => {
        try {
          const data = JSON.parse(event.data as string)
          if (data.type === 'interim') {
            if (typeof data.text === 'string') setInterimTranscript(data.text)
            if (typeof data.translation === 'string') setInterimTranslation(data.translation)
          } else if (data.type === 'final') {
            finalReceivedRef.current = true
            const finalTxt = ((data.text as string) || '').trim()
            const finalTrans = ((data.translation as string) || '').trim()
            setInterimTranscript(finalTxt)
            setInterimTranslation(finalTrans)
            const resultText = liveTranslateRef.current && finalTrans ? finalTrans : finalTxt
            onTranscribed(resultText, finalTrans)
            setSttStatus(resultText ? 'Transcription added.' : 'No speech detected.')
            setSttState('idle')
            cleanupAudio()
          } else if (data.type === 'error') {
            isStreamingRef.current = false
            const code = data.error_code as string
            if (code === 'WHISPER_UNAVAILABLE') {
              setSttStatus('Whisper offline — falling back to batch mode.')
            }
          }
        } catch { /* non-JSON frame */ }
      }

      ws.onerror = () => { isStreamingRef.current = false }
      ws.onclose = () => { isStreamingRef.current = false }
    } catch { isStreamingRef.current = false }

    // 3. Web Audio API: capture mono 16kHz PCM and pipe to WebSocket
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const audioCtx = new AudioCtx()
      audioContextRef.current = audioCtx

      const sourceNode = audioCtx.createMediaStreamSource(streamRef.current as MediaStream)
      const processor = audioCtx.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = e => {
        if (isPausedRef.current) return
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
        const channelData = e.inputBuffer.getChannelData(0)
        const pcm16 = downsampleAndConvertToPCM(channelData, audioCtx.sampleRate, 16000)
        try { wsRef.current.send(pcm16.buffer) } catch { /* send failure */ }
      }

      // Mute output to avoid feedback
      const muteGain = audioCtx.createGain()
      muteGain.gain.value = 0
      sourceNode.connect(processor)
      processor.connect(muteGain)
      muteGain.connect(audioCtx.destination)
    } catch { /* AudioContext failure */ }

    setSttState('recording')
    setSttStatus('Recording…')
  }, [cleanupAudio, onTranscribed])

  const togglePause = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (sttState === 'recording') {
      isPausedRef.current = true
      if (recorder?.state === 'recording') recorder.pause()
      setSttState('paused')
      setSttStatus('Paused.')
    } else if (sttState === 'paused') {
      isPausedRef.current = false
      if (recorder?.state === 'paused') recorder.resume()
      setSttState('recording')
      setSttStatus('Recording…')
    }
  }, [sttState])

  const stop = useCallback(async () => {
    setSttStatus('Finishing capture…')
    setSttState('transcribing')

    const ws = wsRef.current
    const wasStreaming = isStreamingRef.current && ws?.readyState === WebSocket.OPEN

    if (wasStreaming && ws) {
      try { ws.send(JSON.stringify({ action: 'stop' })) } catch { /* ignore */ }

      // Wait up to 5 s for the final frame
      await new Promise<void>(resolve => {
        const interval = setInterval(() => {
          if (finalReceivedRef.current || !wsRef.current) {
            clearInterval(interval)
            resolve()
          }
        }, 100)
        setTimeout(() => { clearInterval(interval); resolve() }, 5000)
      })

      if (finalReceivedRef.current) {
        cleanupAudio()
        return
      }
    }

    // Fallback: batch REST transcription
    const recorder = mediaRecorderRef.current
    const chunks = recordedChunksRef.current
    const mimeType = recorder?.mimeType || 'audio/webm'
    mediaRecorderRef.current = null
    recordedChunksRef.current = []

    cleanupAudio()

    const blob = new Blob(chunks, { type: mimeType })
    if (!blob.size) {
      setSttState('idle')
      setSttStatus('Nothing recorded.')
      return
    }

    try {
      const text = await transcribeAudio(blob)
      onTranscribed(text)
      setSttStatus(text ? 'Transcription added.' : 'No speech detected.')
    } catch (e: unknown) {
      setSttStatus(`Transcription failed: ${(e as Error).message}`)
    }
    setSttState('idle')
  }, [cleanupAudio, onTranscribed])

  useEffect(() => () => { cleanupAudio() }, [cleanupAudio])

  return {
    sttState,
    sttStatus,
    interimTranscript,
    interimTranslation,
    liveTranslateEnabled,
    setLiveTranslateEnabled,
    start,
    togglePause,
    stop,
  }
}
