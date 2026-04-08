import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFs = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  watch: vi.fn(),
}));

vi.mock('node:fs', () => ({ default: mockFs, ...mockFs }));

const { watchPlansDir } = await import('./planWatcher.js');

describe('watchPlansDir', () => {
  let watchCallback: (eventType: string, filename: string | null) => void;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();

    mockFs.existsSync.mockReturnValue(true);
    mockFs.watch.mockImplementation((_path: any, callback: any) => {
      watchCallback = callback;
      return { close: vi.fn() } as any;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('warns and returns early if directory does not exist', () => {
    mockFs.existsSync.mockReturnValue(false);
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onUpdate = vi.fn();

    watchPlansDir('/nonexistent', onUpdate);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
    expect(mockFs.watch).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('calls fs.watch on the provided directory', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    watchPlansDir('/plans', vi.fn());
    expect(mockFs.watch).toHaveBeenCalledWith('/plans', expect.any(Function));
  });

  it('ignores non-.md files', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const onUpdate = vi.fn();
    watchPlansDir('/plans', onUpdate);

    watchCallback('change', 'file.txt');
    vi.advanceTimersByTime(500);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('ignores null filename', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const onUpdate = vi.fn();
    watchPlansDir('/plans', onUpdate);

    watchCallback('change', null);
    vi.advanceTimersByTime(500);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('calls onUpdate with filename and content after debounce', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const onUpdate = vi.fn();
    mockFs.readFileSync.mockReturnValue('# Plan content');

    watchPlansDir('/plans', onUpdate);
    watchCallback('change', 'test.md');

    vi.advanceTimersByTime(100);
    expect(onUpdate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(onUpdate).toHaveBeenCalledWith('test.md', '# Plan content');
  });

  it('debounces rapid events for the same file', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const onUpdate = vi.fn();
    mockFs.readFileSync.mockReturnValue('content');

    watchPlansDir('/plans', onUpdate);

    watchCallback('change', 'test.md');
    vi.advanceTimersByTime(100);
    watchCallback('change', 'test.md');
    vi.advanceTimersByTime(100);
    watchCallback('change', 'test.md');

    vi.advanceTimersByTime(300);
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('handles file deleted between event and read', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const onUpdate = vi.fn();
    mockFs.readFileSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });

    watchPlansDir('/plans', onUpdate);
    watchCallback('change', 'deleted.md');
    vi.advanceTimersByTime(300);

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('handles different files independently', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const onUpdate = vi.fn();
    mockFs.readFileSync.mockReturnValue('content');

    watchPlansDir('/plans', onUpdate);

    watchCallback('change', 'a.md');
    watchCallback('change', 'b.md');
    vi.advanceTimersByTime(300);

    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenCalledWith('a.md', 'content');
    expect(onUpdate).toHaveBeenCalledWith('b.md', 'content');
  });
});
