const { expect } = require('chai');
const sinon = require('sinon');
const winston = require('winston');
const { logger } = require('../../utils/logger');

describe('Logger', () => {
    let clock;

    beforeEach(() => {
        clock = sinon.useFakeTimers();
    });

    afterEach(() => {
        clock.restore();
        sinon.restore();
    });

    describe('Log Levels', () => {
        it('should log at correct levels', () => {
            const spy = sinon.spy(logger, 'log');

            logger.error('Error message');
            logger.warn('Warning message');
            logger.info('Info message');
            logger.debug('Debug message');

            expect(spy.callCount).to.equal(4);
            expect(spy.getCall(0).args[0].level).to.equal('error');
            expect(spy.getCall(1).args[0].level).to.equal('warn');
            expect(spy.getCall(2).args[0].level).to.equal('info');
            expect(spy.getCall(3).args[0].level).to.equal('debug');
        });

        it('should include timestamp in logs', () => {
            const spy = sinon.spy(logger, 'log');
            const now = new Date();
            clock.tick(now.getTime());

            logger.info('Test message');

            const logCall = spy.getCall(0);
            expect(logCall.args[0].timestamp).to.equal(now.toISOString());
        });

        it('should handle objects in log messages', () => {
            const spy = sinon.spy(logger, 'log');
            const testObject = { key: 'value' };

            logger.info('Test message', testObject);

            const logCall = spy.getCall(0);
            expect(logCall.args[0].message).to.equal('Test message');
            expect(logCall.args[0].meta).to.deep.equal(testObject);
        });

        it('should handle errors with stack traces', () => {
            const spy = sinon.spy(logger, 'log');
            const error = new Error('Test error');

            logger.error('Error occurred', error);

            const logCall = spy.getCall(0);
            expect(logCall.args[0].stack).to.equal(error.stack);
        });
    });

    describe('Log Rotation', () => {
        it('should create new log file when size limit reached', () => {
            // Implementation depends on your log rotation setup
        });

        it('should maintain correct number of backup files', () => {
            // Implementation depends on your log rotation setup
        });
    });
}); 