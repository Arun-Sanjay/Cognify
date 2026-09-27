import { describe, expect, it, beforeEach, vi } from 'vitest'

import { adminApi } from '../api/client'

describe('adminApi.listUsers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('hits /admin/users with no querystring when no params', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ total: 0, items: [] }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    await adminApi.listUsers()
    expect(fetchMock).toHaveBeenCalledOnce()
    const calls = fetchMock.mock.calls as unknown as unknown[][]
    expect(calls.length).toBeGreaterThan(0)
    const url = String(calls[0]?.[0] ?? '')
    expect(url.endsWith('/admin/users')).toBe(true)
  })

  it('passes role + search + limit + offset as query params', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ total: 0, items: [] }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    await adminApi.listUsers({
      role: 'student',
      search: 'meera',
      limit: 25,
      offset: 50,
    })
    const calls = fetchMock.mock.calls as unknown as unknown[][]
    expect(calls.length).toBeGreaterThan(0)
    const url = String(calls[0]?.[0] ?? '')
    expect(url).toContain('role=student')
    expect(url).toContain('search=meera')
    expect(url).toContain('limit=25')
    expect(url).toContain('offset=50')
  })
})
