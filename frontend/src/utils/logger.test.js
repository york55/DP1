import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger, createLogger } from './logger';
import { logApi } from '../api/simulationApi';

vi.mock('../api/simulationApi', () => ({
  logApi: {
    send: vi.fn().mockResolvedValue({}),
  },
}));

describe('Frontend Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should format and send error logs to the backend API', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logger.error('Test error message', { cause: 'Testing' });

    expect(errorSpy).toHaveBeenCalled();
    expect(logApi.send).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'ERROR',
        context: 'FRONTEND',
      })
    );
    
    errorSpy.mockRestore();
  });
  
  it('should use custom context when createLogger is used', async () => {
    const customLogger = createLogger('CUSTOM_CONTEXT');
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    customLogger.info('Test custom info');

    expect(infoSpy).toHaveBeenCalled();
    expect(logApi.send).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'INFO',
        context: 'CUSTOM_CONTEXT',
      })
    );
    
    infoSpy.mockRestore();
  });
});
