import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAPI } from './useAPI';

describe('useAPI', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('should make GET requests', async () => {
    const mockResponse = { data: 'test' };
    const mockFetch = global.fetch as unknown as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const api = useAPI();
    const result = await api.get('/test');

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockResponse);
  });

  it('should make POST requests with body', async () => {
    const mockResponse = { id: '123' };
    const mockFetch = global.fetch as unknown as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const api = useAPI();
    const result = await api.post('/test', { name: 'test' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/test'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'test' }),
      })
    );
  });

  it('should handle errors', async () => {
    const mockFetch = global.fetch as unknown as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
    });

    const api = useAPI();
    const result = await api.get('/test');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Not Found');
  });

  it('should handle fetch exceptions', async () => {
    const mockFetch = global.fetch as unknown as ReturnType<typeof vi.fn>;
    mockFetch.mockRejectedValue(new Error('Network error'));

    const api = useAPI();
    const result = await api.get('/test');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Network error');
  });
});
