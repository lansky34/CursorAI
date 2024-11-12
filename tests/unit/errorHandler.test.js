const { expect } = require('chai');
const sinon = require('sinon');
const {
    AppError,
    errorHandler,
    handleDatabaseError
} = require('../../utils/errorHandler');

describe('Error Handler', () => {
    let req;
    let res;
    let next;

    beforeEach(() => {
        req = {
            path: '/test',
            method: 'GET',
            ip: '127.0.0.1'
        };
        res = {
            status: sinon.stub().returnsThis(),
            json: sinon.stub()
        };
        next = sinon.stub();
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('AppError', () => {
        it('should create operational error', () => {
            const error = new AppError(400, 'Bad request');
            
            expect(error).to.be.instanceOf(Error);
            expect(error.statusCode).to.equal(400);
            expect(error.message).to.equal('Bad request');
            expect(error.isOperational).to.be.true;
        });

        it('should create programming error', () => {
            const error = new AppError(500, 'Server error', false);
            
            expect(error.statusCode).to.equal(500);
            expect(error.isOperational).to.be.false;
        });
    });

    describe('errorHandler middleware', () => {
        it('should handle operational errors', () => {
            const error = new AppError(400, 'Bad request');
            
            errorHandler(error, req, res, next);

            expect(res.status.calledWith(400)).to.be.true;
            expect(res.json.calledWith({
                status: 'fail',
                message: 'Bad request'
            })).to.be.true;
        });

        it('should handle programming errors in production', () => {
            process.env.NODE_ENV = 'production';
            const error = new Error('Internal error');
            
            errorHandler(error, req, res, next);

            expect(res.status.calledWith(500)).to.be.true;
            expect(res.json.calledWith({
                status: 'error',
                message: 'Something went wrong'
            })).to.be.true;
        });

        it('should include stack trace in development', () => {
            process.env.NODE_ENV = 'development';
            const error = new Error('Internal error');
            
            errorHandler(error, req, res, next);

            const response = res.json.getCall(0).args[0];
            expect(response.stack).to.exist;
        });
    });

    describe('handleDatabaseError', () => {
        it('should handle unique violation', () => {
            const dbError = { code: '23505' };
            const error = handleDatabaseError(dbError);
            
            expect(error).to.be.instanceOf(AppError);
            expect(error.statusCode).to.equal(400);
            expect(error.message).to.equal('Duplicate entry found');
        });

        it('should handle foreign key violation', () => {
            const dbError = { code: '23503' };
            const error = handleDatabaseError(dbError);
            
            expect(error).to.be.instanceOf(AppError);
            expect(error.statusCode).to.equal(400);
            expect(error.message).to.equal('Referenced record not found');
        });

        it('should handle unknown database errors', () => {
            const dbError = { code: 'unknown' };
            const error = handleDatabaseError(dbError);
            
            expect(error).to.be.instanceOf(AppError);
            expect(error.statusCode).to.equal(500);
        });
    });
}); 