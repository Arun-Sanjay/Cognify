import { describe, expect, it } from 'vitest'
import {
  formatCount,
  formatDuration,
  formatTimestamp,
  linkTimestamps,
  toSeconds,
} from '../components/learn/format'

describe('learn format helpers', () => {
  it('formats timestamps', () => {
    expect(formatTimestamp(0)).toBe('0:00')
    expect(formatTimestamp(754)).toBe('12:34')
    expect(formatTimestamp(3725)).toBe('1:02:05')
  })

  it('formats counts', () => {
    expect(formatCount(null)).toBe('—')
    expect(formatCount(873)).toBe('873')
    expect(formatCount(46500)).toBe('46.5K')
    expect(formatCount(2723123)).toBe('2.7M')
  })

  it('formats durations', () => {
    expect(formatDuration(741)).toBe('12 min')
    expect(formatDuration(5400)).toBe('1 h 30 min')
    expect(formatDuration(7200)).toBe('2 h')
  })

  it('converts stamps to seconds', () => {
    expect(toSeconds('3:35')).toBe(215)
    expect(toSeconds('1:02:05')).toBe(3725)
  })

  it('links cited timestamps (and the start of ranges) to #t= anchors', () => {
    expect(linkTimestamps('see [3:35] and [4:31–5:10]')).toBe(
      'see [3:35](#t=215) and [4:31–5:10](#t=271)',
    )
    // Markdown links and non-time brackets are left alone.
    expect(linkTimestamps('[A] then [note](x) and [12]')).toBe('[A] then [note](x) and [12]')
  })
})
