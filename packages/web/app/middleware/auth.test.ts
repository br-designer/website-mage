import { describe, it, expect, vi, beforeEach } from 'vitest';
import authMiddleware from './auth';

describe('auth middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow access to login page without authentication', () => {
    const mockUser = { value: null };
    global.useSupabaseUser = vi.fn(() => mockUser);
    global.navigateTo = vi.fn();

    const to = { path: '/login' } as { path: string };
    const from = { path: '/' } as { path: string };

    const result = authMiddleware(to, from);

    expect(result).toBeUndefined();
    expect(global.navigateTo).not.toHaveBeenCalled();
  });

  it('should redirect to login when user is not authenticated', () => {
    const mockUser = { value: null };
    global.useSupabaseUser = vi.fn(() => mockUser);
    global.navigateTo = vi.fn(() => '/login');

    const to = { path: '/dashboard' } as { path: string };
    const from = { path: '/' } as { path: string };

    const result = authMiddleware(to, from);

    expect(global.navigateTo).toHaveBeenCalledWith('/login');
    expect(result).toBe('/login');
  });

  it('should allow access when user is authenticated', () => {
    const mockUser = { value: { id: '123', email: 'test@example.com' } };
    global.useSupabaseUser = vi.fn(() => mockUser);
    global.navigateTo = vi.fn();

    const to = { path: '/dashboard' } as { path: string };
    const from = { path: '/login' } as { path: string };

    const result = authMiddleware(to, from);

    expect(result).toBeUndefined();
    expect(global.navigateTo).not.toHaveBeenCalled();
  });
});
