import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Reset module to get fresh logger instance
vi.resetModules();

describe('logger', () => {
  let logger: any;
  let consoleSpy: {
    debug: ReturnType<typeof vi.spyOn>;
    log: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(async () => {
    vi.resetModules();

    // Spy on console methods
    consoleSpy = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };

    // Import fresh logger instance
    const loggerModule = await import('../logger');
    logger = loggerModule.logger;

    // Enable logging for tests
    logger.setEnabled(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('configuration', () => {
    it('should configure multiple settings at once', () => {
      logger.configure({
        enabled: false,
        minLevel: 'warn',
        enabledCategories: ['auth']
      });

      logger.auth('Test message');
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it('should enable and disable logging', () => {
      logger.setEnabled(true);
      logger.auth('Enabled message');
      expect(consoleSpy.log).toHaveBeenCalled();

      consoleSpy.log.mockClear();

      logger.setEnabled(false);
      logger.auth('Disabled message');
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it('should set minimum log level', () => {
      logger.setMinLevel('warn');

      logger.info('auth', 'Info message');
      expect(consoleSpy.log).not.toHaveBeenCalled();

      logger.warn('auth', 'Warn message');
      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it('should set enabled categories', () => {
      logger.setCategories(['auth']);

      logger.auth('Auth message');
      expect(consoleSpy.log).toHaveBeenCalled();

      consoleSpy.log.mockClear();

      logger.spotify('Spotify message');
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });
  });

  describe('log level filtering', () => {
    it('should not log when level is below minimum', () => {
      logger.setMinLevel('info');

      logger.debug('auth', 'Debug message');
      expect(consoleSpy.debug).not.toHaveBeenCalled();
    });

    it('should log when level meets minimum', () => {
      logger.setMinLevel('info');

      logger.info('auth', 'Info message');
      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it('should log when level exceeds minimum', () => {
      logger.setMinLevel('info');

      logger.warn('auth', 'Warning message');
      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it('should log error level at any minLevel except higher', () => {
      logger.setMinLevel('debug');

      logger.error('auth', 'Error message');
      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });

  describe('category filtering', () => {
    it('should log enabled categories', () => {
      logger.setCategories(['auth', 'session']);

      logger.auth('Auth message');
      logger.session('Session message');

      expect(consoleSpy.log).toHaveBeenCalledTimes(2);
    });

    it('should not log disabled categories', () => {
      logger.setCategories(['auth']);

      logger.spotify('Spotify message');
      logger.token('Token message');
      logger.general('General message');

      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it('should handle empty categories array', () => {
      logger.setCategories([]);

      logger.auth('Auth message');
      logger.session('Session message');

      expect(consoleSpy.log).not.toHaveBeenCalled();
    });
  });

  describe('category-specific methods', () => {
    beforeEach(() => {
      logger.setCategories(['auth', 'session', 'spotify', 'token', 'general']);
      logger.setMinLevel('debug');
    });

    it('should log auth messages', () => {
      logger.auth('Auth test');
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('[AUTH]')
      );
    });

    it('should log auth messages with data', () => {
      const data = { userId: '123' };
      logger.auth('Auth test', data);
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('[AUTH]'),
        data
      );
    });

    it('should log auth messages with custom level', () => {
      logger.auth('Auth warning', undefined, 'warn');
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('[AUTH]')
      );
    });

    it('should log session messages', () => {
      logger.session('Session test');
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('[SESSION]')
      );
    });

    it('should log session messages with data', () => {
      const data = { sessionId: 'abc' };
      logger.session('Session test', data);
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('[SESSION]'),
        data
      );
    });

    it('should log spotify messages', () => {
      logger.spotify('Spotify test');
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('[SPOTIFY]')
      );
    });

    it('should log spotify messages with data', () => {
      const data = { trackId: 'track123' };
      logger.spotify('Spotify test', data);
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('[SPOTIFY]'),
        data
      );
    });

    it('should log token messages', () => {
      logger.token('Token test');
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('[TOKEN]')
      );
    });

    it('should log token messages with data', () => {
      const data = { expires: 3600 };
      logger.token('Token test', data);
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('[TOKEN]'),
        data
      );
    });

    it('should log general messages', () => {
      logger.general('General test');
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('[GENERAL]')
      );
    });

    it('should log general messages with data', () => {
      const data = { key: 'value' };
      logger.general('General test', data);
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('[GENERAL]'),
        data
      );
    });
  });

  describe('level-specific methods', () => {
    beforeEach(() => {
      logger.setMinLevel('debug');
      logger.setCategories(['auth']);
    });

    it('should log debug messages', () => {
      logger.debug('auth', 'Debug test');
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining('[AUTH]')
      );
    });

    it('should log debug messages with data', () => {
      const data = { debug: true };
      logger.debug('auth', 'Debug test', data);
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining('[AUTH]'),
        data
      );
    });

    it('should log info messages', () => {
      logger.info('auth', 'Info test');
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('[AUTH]')
      );
    });

    it('should log info messages with data', () => {
      const data = { info: 'value' };
      logger.info('auth', 'Info test', data);
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('[AUTH]'),
        data
      );
    });

    it('should log warn messages', () => {
      logger.warn('auth', 'Warn test');
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('[AUTH]')
      );
    });

    it('should log warn messages with data', () => {
      const data = { warning: 'alert' };
      logger.warn('auth', 'Warn test', data);
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('[AUTH]'),
        data
      );
    });

    it('should log error messages', () => {
      logger.error('auth', 'Error test');
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('[AUTH]')
      );
    });

    it('should log error messages with data', () => {
      const data = { error: 'details' };
      logger.error('auth', 'Error test', data);
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('[AUTH]'),
        data
      );
    });
  });

  describe('message formatting', () => {
    beforeEach(() => {
      logger.setMinLevel('debug');
    });

    it('should include timestamp in log message', () => {
      logger.auth('Test message');

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      );
    });

    it('should include category in uppercase', () => {
      logger.auth('Test message');

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('[AUTH]')
      );
    });

    it('should include the message content', () => {
      logger.auth('Specific message content');

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Specific message content')
      );
    });
  });

  describe('disabled logging', () => {
    it('should not log any level when disabled', () => {
      logger.setEnabled(false);
      logger.setMinLevel('debug');

      logger.debug('auth', 'Debug');
      logger.info('auth', 'Info');
      logger.warn('auth', 'Warn');
      logger.error('auth', 'Error');

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.log).not.toHaveBeenCalled();
      expect(consoleSpy.warn).not.toHaveBeenCalled();
      expect(consoleSpy.error).not.toHaveBeenCalled();
    });

    it('should not log any category when disabled', () => {
      logger.setEnabled(false);

      logger.auth('Auth');
      logger.session('Session');
      logger.spotify('Spotify');
      logger.token('Token');
      logger.general('General');

      expect(consoleSpy.log).not.toHaveBeenCalled();
    });
  });
});
