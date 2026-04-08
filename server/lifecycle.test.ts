import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFs = vi.hoisted(() => ({
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

vi.mock('node:fs', () => ({ default: mockFs, ...mockFs }));
vi.mock('node:os', () => ({
  default: { tmpdir: () => '/tmp' },
  tmpdir: () => '/tmp',
}));

const { writePidFile, writePortFile, cleanupFiles, readPortFile, isServerRunning, resetIdleTimer } =
  await import('./lifecycle.js');

describe('lifecycle', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('writePidFile', () => {
    it('writes process PID to correct path', () => {
      writePidFile();
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/tmp/cc-plan-viewer.pid',
        String(process.pid),
        'utf8'
      );
    });
  });

  describe('writePortFile', () => {
    it('writes port number to correct path', () => {
      writePortFile(3847);
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/tmp/cc-plan-viewer-port',
        '3847',
        'utf8'
      );
    });
  });

  describe('cleanupFiles', () => {
    it('unlinks both PID and port files', () => {
      cleanupFiles();
      expect(mockFs.unlinkSync).toHaveBeenCalledWith('/tmp/cc-plan-viewer.pid');
      expect(mockFs.unlinkSync).toHaveBeenCalledWith('/tmp/cc-plan-viewer-port');
    });

    it('swallows errors when files do not exist', () => {
      mockFs.unlinkSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });
      expect(() => cleanupFiles()).not.toThrow();
    });
  });

  describe('readPortFile', () => {
    it('returns port number from file', () => {
      mockFs.readFileSync.mockReturnValue('3847');
      expect(readPortFile()).toBe(3847);
    });

    it('returns null when file does not exist', () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });
      expect(readPortFile()).toBeNull();
    });

    it('returns null when file contains non-numeric content', () => {
      mockFs.readFileSync.mockReturnValue('not-a-number');
      expect(readPortFile()).toBeNull();
    });

    it('handles port with whitespace', () => {
      mockFs.readFileSync.mockReturnValue('  3847\n');
      expect(readPortFile()).toBe(3847);
    });
  });

  describe('isServerRunning', () => {
    it('returns true when PID file exists and process is alive', () => {
      mockFs.readFileSync.mockReturnValue('12345');
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);

      expect(isServerRunning()).toBe(true);
      expect(killSpy).toHaveBeenCalledWith(12345, 0);
      killSpy.mockRestore();
    });

    it('returns false when PID file does not exist', () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });
      expect(isServerRunning()).toBe(false);
    });

    it('returns false when process is not alive', () => {
      mockFs.readFileSync.mockReturnValue('12345');
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {
        throw new Error('ESRCH');
      });
      expect(isServerRunning()).toBe(false);
      killSpy.mockRestore();
    });

    it('returns false when PID is NaN', () => {
      mockFs.readFileSync.mockReturnValue('garbage');
      expect(isServerRunning()).toBe(false);
    });
  });

  describe('resetIdleTimer', () => {
    it('sets a timer', () => {
      const spy = vi.spyOn(global, 'setTimeout');
      resetIdleTimer();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
