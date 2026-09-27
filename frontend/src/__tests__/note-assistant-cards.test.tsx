import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ChatMessage from '../components/chat/ChatMessage'

// Hoisted mock for the lazy-loaded `mermaid` module so tests don't need the
// real ~600KB library and don't trigger network/disk fetches in jsdom.
const mockRender = vi.fn(async (id: string, source: string) => ({
  svg: `<svg data-testid="mermaid-svg" data-source="${source}" data-id="${id}"></svg>`,
}))
const mockInitialize = vi.fn()

vi.mock('mermaid', () => ({
  default: {
    initialize: mockInitialize,
    render: mockRender,
  },
}))

afterEach(() => {
  mockRender.mockClear()
  mockInitialize.mockClear()
})

describe('ChatMessage — Note Assistant cards', () => {
  it('renders a SolvedCard from a ```solved fence with stepped + answer sub-blocks', () => {
    const content = [
      'Here is a worked example.',
      '',
      '```solved',
      '{"index": 1, "problem": "Solve x + 2 = 5"}',
      'STEP 1 — ISOLATE X',
      'Subtract 2 from both sides.',
      '',
      'STEP 2 — COMPUTE',
      'x = 3',
      '',
      'ANSWER',
      'x = 3',
      '```',
    ].join('\n')

    render(<ChatMessage role="assistant" content={content} />)

    expect(screen.getByText('Solved 1')).toBeInTheDocument()
    expect(screen.getByText('Solve x + 2 = 5')).toBeInTheDocument()
    expect(screen.getByText('STEP 1 — ISOLATE X')).toBeInTheDocument()
    expect(screen.getByText('STEP 2 — COMPUTE')).toBeInTheDocument()
    expect(screen.getByText('Answer')).toBeInTheDocument()
  })

  it('UnsolvedCard hides the hint until "Show hint" is clicked', () => {
    const content = [
      '```unsolved',
      '{"index": 1, "problem": "Try this one", "hint": "Use the chain rule."}',
      'A short intro to the problem.',
      '',
      'Steps to try:',
      '1. Identify the outer function.',
      '```',
    ].join('\n')

    render(<ChatMessage role="assistant" content={content} />)

    expect(screen.getByText('Your turn')).toBeInTheDocument()
    expect(screen.getByText('Try this one')).toBeInTheDocument()
    // Hint hidden initially
    expect(screen.queryByText('Use the chain rule.')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /show hint/i }))
    expect(screen.getByText('Use the chain rule.')).toBeInTheDocument()
  })

  it('falls back gracefully when the meta JSON is missing', () => {
    const content = [
      '```solved',
      'STEP 1 — ONLY STEP',
      'Just do it.',
      '',
      'ANSWER',
      '42',
      '```',
    ].join('\n')

    render(<ChatMessage role="assistant" content={content} />)

    // Default badge + problem fallback
    expect(screen.getByText('Solved')).toBeInTheDocument()
    expect(screen.getByText('Problem')).toBeInTheDocument()
    // Step + answer still parsed from body
    expect(screen.getByText('STEP 1 — ONLY STEP')).toBeInTheDocument()
    expect(screen.getByText('Answer')).toBeInTheDocument()
  })

  it('renders a MermaidDiagram from a ```mermaid fence and lazy-loads the library', async () => {
    const content = [
      'A simple flowchart:',
      '',
      '```mermaid',
      'flowchart TD',
      '  A[Start] --> B[End]',
      '```',
    ].join('\n')

    render(<ChatMessage role="assistant" content={content} isStreaming={false} />)

    await waitFor(() => {
      expect(mockRender).toHaveBeenCalledTimes(1)
    })
    const [, source] = mockRender.mock.calls[0]!
    expect(source).toContain('flowchart TD')
    expect(source).toContain('A[Start] --> B[End]')

    await waitFor(() => {
      expect(screen.getByTestId('mermaid-svg')).toBeInTheDocument()
    })
  })

  it('shows the "Generating diagram..." placeholder while streaming', () => {
    const content = ['```mermaid', 'flowchart TD', '  A --> B', '```'].join('\n')
    render(<ChatMessage role="assistant" content={content} isStreaming={true} />)
    expect(screen.getByText(/generating diagram/i)).toBeInTheDocument()
    expect(mockRender).not.toHaveBeenCalled()
  })

  it('appends a synthetic closing fence when streaming ends mid-fence', () => {
    // Truncated content (no closing ``` ) — would otherwise render as one
    // runaway code block. Renderer auto-closes it.
    const content = [
      '```solved',
      '{"index": 1, "problem": "Half-finished problem"}',
      'STEP 1 — START',
      'A first step.',
    ].join('\n')

    render(<ChatMessage role="assistant" content={content} isStreaming={false} />)

    // SolvedCard renders even though the fence wasn't closed by the LLM.
    expect(screen.getByText('Solved 1')).toBeInTheDocument()
    expect(screen.getByText('Half-finished problem')).toBeInTheDocument()
  })
})
