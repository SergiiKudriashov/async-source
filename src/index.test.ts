import {
    it,
    vi,
    expect,
    describe,
    afterEach,
    beforeEach
} from "vitest";

import AsyncSource from "./index";

// test utils
const getRandom = {
    string(length = 10) {
        let result = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
        const charactersLength = characters.length;

        for (let i = 0; i < length; i++) {
            const randomIndex = Math.floor(Math.random() * charactersLength);
            result += characters.charAt(randomIndex);
        }

        return result;
    }
}
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const flushPromises = () => new Promise(setImmediate);

const makeInitialCall = async (sut: AsyncSource<unknown>) => {
    sut.update();
    await flushPromises();
    vi.clearAllMocks();
}

// mocks
const mockedEmptyMethod = vi.fn(() => Promise.resolve());
const mockedEmptyErrorHandler = vi.fn();
const mockedMethod = vi.fn(response => Promise.resolve(response))
const mockedMethodWithDelay = vi.fn(async (delayTime, response?) => {
    await delay(delayTime);
    return Promise.resolve(response);
});
const mockedMethodWithError = vi.fn(error => Promise.reject(error));

// tests
let sut: AsyncSource<unknown>;
describe('Async source', () => {
    afterEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    })

    describe('after creation', () => {
        it('should have empty response data', () => {
            sut = new AsyncSource(mockedEmptyMethod, mockedEmptyErrorHandler, 100);

            expect(sut.data).toBeNull();
        })

        it('should indicate as not fetched', () => {
            sut = new AsyncSource(mockedEmptyMethod);

            expect(sut.isFetch).toBe(false);
        })

        it('should indicate loading not in progress', () => {
            sut = new AsyncSource(mockedEmptyMethod);

            expect(sut.isLoading).toBe(false);
        })
    })

    describe('methods', () => {
        describe('update', () => {
            it('should change loading state to true', () => {
                sut = new AsyncSource(mockedEmptyMethod, mockedEmptyErrorHandler)

                sut.update();

                expect(sut.isLoading).toBe(true);
            })

            it('should change loading state to false when finished', () => {
                sut = new AsyncSource(mockedEmptyMethod, mockedEmptyErrorHandler)

                sut.update();

                expect(sut.isLoading).toBe(true);
            })

            it('should save response to data', async () => {
                const mockedResponse = getRandom.string();
                const serviceMethod = () => mockedMethod(mockedResponse);
                sut = new AsyncSource(serviceMethod, mockedEmptyErrorHandler)

                await sut.update();

                expect(sut.data).toBe(mockedResponse);
            })

            it('should call error handler on error', async () => {
                const mockedError = new Error(getRandom.string());
                const serviceMethodWithError = () => mockedMethodWithError(mockedError);
                sut = new AsyncSource(serviceMethodWithError, mockedEmptyErrorHandler);

                await sut.update();

                expect(mockedEmptyErrorHandler).toHaveBeenCalledOnce();
                expect(mockedEmptyErrorHandler).toHaveBeenCalledWith(mockedError);
            });
        })

        describe('updateIfEmpty', () => {
            beforeEach(() => {
                const serviceMethod = vi.fn((value) => Promise.resolve(value));
                sut = new AsyncSource(serviceMethod, vi.fn())
            })

            it('should change loading state to true', () => {
                sut.updateIfEmpty();

                expect(sut.isLoading).toBe(true);
            })

            it('should change loading state to false when finished', async () => {
                await sut.updateIfEmpty();

                expect(sut.isLoading).toBe(false);
            })

            it('should save response to data only once', async () => {
                const mockedResponse = getRandom.string();
                const serviceMethod = () => mockedMethod(mockedResponse);
                sut = new AsyncSource(serviceMethod, mockedEmptyErrorHandler)

                await sut.updateIfEmpty(mockedResponse);

                expect(sut.data).toBe(mockedResponse);

                await sut.updateIfEmpty(1);

                expect(sut.data).toBe(mockedResponse);
            })
        })

        describe('updateImmediate', () => {
            beforeEach(() => {
                const serviceMethod = vi.fn(() => Promise.resolve());
                sut = new AsyncSource(serviceMethod, vi.fn())
            });

            it('should change loading state to true', () => {
                sut.updateImmediate();

                expect(sut.isLoading).toBe(true);
            });

            it('should change loading state to false when finished', async () => {
                await sut.updateImmediate();

                expect(sut.isLoading).toBe(false);
            });

            it('should save response to data', async () => {
                const mockedResponse = getRandom.string();
                const serviceMethod = () => mockedMethod(mockedResponse);
                sut = new AsyncSource(serviceMethod, mockedEmptyErrorHandler)

                await sut.updateImmediate();

                expect(sut.data).toBe(mockedResponse);
            });


            it('should ignore response to data', async () => {
                const mockedResponse = getRandom.string();
                const serviceMethod = () => mockedMethod(mockedResponse);
                sut = new AsyncSource(serviceMethod, mockedEmptyErrorHandler)

                await sut.updateImmediate();

                expect(sut.data).toBe(mockedResponse);
            });
        })

        describe('push', () => {
            beforeEach(() => {
                const serviceMethod = vi.fn(() => Promise.resolve());
                sut = new AsyncSource(serviceMethod, vi.fn())
            })

            it('should change loading state to true', () => {
                sut.push(vi.fn);

                expect(sut.isLoading).toBe(true);
            })

            it('should change loading state to false when finished', async () => {
                await sut.push(vi.fn);

                expect(sut.isLoading).toBe(false);
            })
        })

        describe('clear', () => {
            beforeEach(() => {
                const serviceMethod = vi.fn(() => Promise.resolve('some data'));
                sut = new AsyncSource(serviceMethod, vi.fn())
            })

            it('should reset data', async () => {
                await sut.update();

                expect(sut.data).toBeTruthy();

                sut.clear()

                expect(sut.data).toBeNull();
            })

            it('should reset isFetch', async () => {
                await sut.update();

                expect(sut.isFetch).toBeTruthy();

                sut.clear()

                expect(sut.isFetch).toBe(false);
            })
        })
    })

    describe('functionality', () => {
        describe('debounce', () => {
            it('should call method immediately once', async () => {
                sut = new AsyncSource(mockedMethod, mockedEmptyErrorHandler, 100);

                sut.update();
                await flushPromises();

                expect(mockedMethod).toHaveBeenCalledTimes(1);
            });

            it('should ignore all calls except last after first call', async () => {
                sut = new AsyncSource(mockedMethod, mockedEmptyErrorHandler, 200);
                await makeInitialCall(sut);

                sut.update();
                await delay(10);
                sut.update();
                await delay(10);
                sut.update();
                await delay(10);
                sut.update();
                await delay(10);
                sut.update();
                await delay(300);

                expect(mockedMethod).toHaveBeenCalledOnce;
            });
        });
    });

    describe('response handling', () => {
        it('should ignore response if it is not the last one', async () => {
            const serviceMethod = () => mockedMethodWithDelay(100, getRandom.string());
            sut = new AsyncSource(serviceMethod, mockedEmptyErrorHandler, 0);
            await makeInitialCall(sut);

            const handlerOne = vi.fn();
            const handlerTwo = vi.fn();
            const handlerThree = vi.fn();

            sut.push(handlerOne);
            await delay(10);
            sut.push(handlerTwo);
            await delay(10);
            sut.push(handlerThree);
            await delay(200);

            expect(handlerOne).not.toHaveBeenCalled();
            expect(handlerTwo).not.toHaveBeenCalled();
            expect(handlerThree).toHaveBeenCalled();
        });
    });
    describe('error handling', () => {
        it('should use error handler stub when handler is not passed', async () => {
            sut = new AsyncSource(mockedMethodWithError);
            const spy = vi.spyOn(sut, 'onError');

            await sut.update();

            expect(spy).toHaveBeenCalled();
        });
    });
});