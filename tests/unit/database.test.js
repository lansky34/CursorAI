const { expect } = require('chai');
const sinon = require('sinon');
const { Pool } = require('pg');
const {
    executeQuery,
    executeTransaction,
    cleanupPool
} = require('../../server');

describe('Database Operations', () => {
    let pool;
    let client;
    let logger;

    beforeEach(() => {
        // Mock pool and client
        client = {
            query: sinon.stub(),
            release: sinon.stub()
        };
        pool = {
            connect: sinon.stub().resolves(client),
            end: sinon.stub().resolves()
        };
        // Mock logger
        logger = {
            info: sinon.stub(),
            error: sinon.stub(),
            debug: sinon.stub()
        };
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('executeQuery', () => {
        it('should execute a query successfully', async () => {
            const expectedResult = { rows: [{ id: 1 }] };
            client.query.resolves(expectedResult);

            const result = await executeQuery('SELECT * FROM test', []);
            
            expect(result).to.deep.equal(expectedResult);
            expect(client.query.calledOnce).to.be.true;
            expect(client.release.calledOnce).to.be.true;
        });

        it('should handle query errors', async () => {
            const error = new Error('Database error');
            client.query.rejects(error);

            try {
                await executeQuery('SELECT * FROM test', []);
                expect.fail('Should have thrown an error');
            } catch (err) {
                expect(err).to.equal(error);
                expect(client.release.calledOnce).to.be.true;
                expect(logger.error.calledOnce).to.be.true;
            }
        });

        it('should handle connection errors', async () => {
            pool.connect.rejects(new Error('Connection error'));

            try {
                await executeQuery('SELECT * FROM test', []);
                expect.fail('Should have thrown an error');
            } catch (err) {
                expect(err.message).to.equal('Connection error');
                expect(logger.error.calledOnce).to.be.true;
            }
        });

        it('should release client even if query fails', async () => {
            client.query.rejects(new Error('Query error'));

            try {
                await executeQuery('SELECT * FROM test', []);
            } catch (err) {
                expect(client.release.calledOnce).to.be.true;
            }
        });
    });

    describe('executeTransaction', () => {
        it('should execute transaction successfully', async () => {
            client.query.resolves();
            const callback = sinon.stub().resolves({ success: true });

            const result = await executeTransaction(callback);

            expect(result).to.deep.equal({ success: true });
            expect(client.query.calledWith('BEGIN')).to.be.true;
            expect(client.query.calledWith('COMMIT')).to.be.true;
            expect(client.release.calledOnce).to.be.true;
        });

        it('should rollback transaction on error', async () => {
            const error = new Error('Transaction error');
            const callback = sinon.stub().rejects(error);

            try {
                await executeTransaction(callback);
                expect.fail('Should have thrown an error');
            } catch (err) {
                expect(err).to.equal(error);
                expect(client.query.calledWith('ROLLBACK')).to.be.true;
                expect(client.release.calledOnce).to.be.true;
            }
        });
    });

    describe('cleanupPool', () => {
        it('should close pool successfully', async () => {
            await cleanupPool();
            expect(pool.end.calledOnce).to.be.true;
            expect(logger.info.calledTwice).to.be.true;
        });

        it('should handle pool closing errors', async () => {
            const error = new Error('Pool closing error');
            pool.end.rejects(error);

            try {
                await cleanupPool();
                expect.fail('Should have thrown an error');
            } catch (err) {
                expect(err).to.equal(error);
                expect(logger.error.calledOnce).to.be.true;
            }
        });
    });
}); 