import { AxiosError } from 'axios';
import { errorMessage } from './errors';

function withResponse(status: number, data: unknown) {
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: {} as never,
    data,
  });
}

describe('errorMessage', () => {
  it('uses the server message when there is one', () => {
    expect(errorMessage(withResponse(409, { message: 'Trip is not in progress' }), 'fallback')).toBe(
      'Trip is not in progress',
    );
  });

  it('explains an unreachable server', () => {
    const noResponse = new AxiosError('Network Error', 'ERR_NETWORK');
    expect(errorMessage(noResponse, 'fallback')).toMatch(/cannot reach the server/i);
  });

  it('falls back for anything else', () => {
    expect(errorMessage(new Error('boom'), 'Something failed')).toBe('Something failed');
    expect(errorMessage(withResponse(500, {}), 'Something failed')).toBe('Request failed');
  });
});
