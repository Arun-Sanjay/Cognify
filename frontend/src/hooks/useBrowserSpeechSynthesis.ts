import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Wrapper around the Web Speech Synthesis API (`window.speechSynthesis`)
 * for browser-side text-to-speech. This is the **free fallback** for the
 * Phase 20 voice interview when ElevenLabs isn't configured (i.e. on a dev
 * laptop with no API keys, or once we burn through the ElevenLabs Starter
 * monthly quota).
 *
 * Quality is robotic compared to ElevenLabs, but it ships in every modern
 * browser (Chrome, Safari, Firefox, Edge), so the demo always has *some*
 * AI voice instead of awkward silence.
 *
 * Voice selection: Chrome and Safari load voices asynchronously — the first
 * `getVoices()` call returns []. We listen for the `voiceschanged` event and
 * cache the best English voice we can find (preferring Google/Apple natural
 * voices, then falling back to whatever en-US voice exists).
 */

interface SpeakOptions {
  /** Speech rate, 0.1 (slow) to 10 (fast). Default 1.0 */
  rate?: number
  /** Pitch, 0 (low) to 2 (high). Default 1.0 */
  pitch?: number
  /** Volume, 0 (mute) to 1 (full). Default 1.0 */
  volume?: number
  /** Override the auto-picked voice */
  voice?: SpeechSynthesisVoice | null
}

export interface UseBrowserSpeechSynthesisReturn {
  supported: boolean
  speaking: boolean
  voice: SpeechSynthesisVoice | null
  voices: SpeechSynthesisVoice[]
  speak: (text: string, options?: SpeakOptions) => void
  cancel: () => void
}

function pickPreferredVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null

  // Priority list: high-quality cloud voices first, then platform natives,
  // then any English voice. We bias toward male/neutral for the "interviewer"
  // vibe but accept whatever is installed.
  const preferenceOrder = [
    /Google US English/i,
    /Microsoft Aria/i,
    /Microsoft Guy/i,
    /Microsoft David/i,
    /Samantha/i, // macOS default
    /Alex/i, // macOS male
    /Daniel/i, // macOS UK male
    /Karen/i, // macOS Australian
    /en[-_]US/i,
    /en[-_]GB/i,
    /^en/i,
  ]

  for (const pattern of preferenceOrder) {
    const match = voices.find(
      (v) => pattern.test(v.name) || pattern.test(v.lang),
    )
    if (match) return match
  }

  // Last resort: any voice at all
  return voices[0] ?? null
}

export function useBrowserSpeechSynthesis(): UseBrowserSpeechSynthesisReturn {
  const [supported] = useState<boolean>(
    () => typeof window !== 'undefined' && 'speechSynthesis' in window,
  )
  const [speaking, setSpeaking] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  // Voice list is async on Chrome — listen for voiceschanged and refresh.
  useEffect(() => {
    if (!supported) return

    const refreshVoices = () => {
      const list = window.speechSynthesis.getVoices()
      setVoices(list)
      setVoice((current) => current ?? pickPreferredVoice(list))
    }

    refreshVoices()
    window.speechSynthesis.addEventListener('voiceschanged', refreshVoices)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', refreshVoices)
    }
  }, [supported])

  // Cancel any pending utterance when the component unmounts so the AI
  // doesn't keep speaking after the user navigates away.
  useEffect(() => {
    return () => {
      if (supported) {
        try {
          window.speechSynthesis.cancel()
        } catch {
          // ignore
        }
      }
    }
  }, [supported])

  const speak = useCallback(
    (text: string, options: SpeakOptions = {}) => {
      if (!supported || !text.trim()) return
      try {
        // Cancel anything still in the queue from a previous turn
        window.speechSynthesis.cancel()

        const utterance = new SpeechSynthesisUtterance(text)
        utterance.rate = options.rate ?? 1.0
        utterance.pitch = options.pitch ?? 1.0
        utterance.volume = options.volume ?? 1.0
        const chosen = options.voice ?? voice
        if (chosen) {
          utterance.voice = chosen
          utterance.lang = chosen.lang
        } else {
          utterance.lang = 'en-US'
        }

        utterance.onstart = () => setSpeaking(true)
        utterance.onend = () => setSpeaking(false)
        utterance.onerror = () => setSpeaking(false)

        utteranceRef.current = utterance
        window.speechSynthesis.speak(utterance)
      } catch {
        setSpeaking(false)
      }
    },
    [supported, voice],
  )

  const cancel = useCallback(() => {
    if (!supported) return
    try {
      window.speechSynthesis.cancel()
    } catch {
      // ignore
    }
    setSpeaking(false)
  }, [supported])

  return { supported, speaking, voice, voices, speak, cancel }
}
