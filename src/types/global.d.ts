declare global {
    namespace NodeJS {
        interface Global {
            __TEST_POOL__: import('pg').Pool;
        }
    }
}

export {}; 