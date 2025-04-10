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

const createMockStorage = () => ({
    getItem: vi.fn().mockImplementation(() => Promise.resolve(null)),
    setItem: vi.fn().mockImplementation(() => Promise.resolve()),
    removeItem: vi.fn().mockImplementation(() => Promise.resolve()),
});

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
    
    describe("AsyncSource Cache Functionality", () => {
        let mockStorage: any;
    
        beforeEach(() => {
            mockStorage = createMockStorage();
            localStorage.clear();
        });
    
        afterEach(() => {
            vi.clearAllMocks();
        });
    
        it("should save data to cache after successful fetch", async () => {
            const response = { data: "test data" };
            const serviceMethod = vi.fn(() => Promise.resolve(response));
        
            sut = new AsyncSource(serviceMethod, vi.fn(), {
                requestCacheKey: "testKey",
                cacheStorage: mockStorage,
                cacheTime: 1000,
                isUpdateCache: true
            });
        
            await sut.update();
            await delay(100)

            expect(mockStorage.getItem).toHaveBeenCalledTimes(2);
            expect(mockStorage.setItem).toHaveBeenCalledOnce();
            const [key, value] = mockStorage.setItem.mock.calls[0];
            expect(key).toContain("AsyncSource-testKey");
        
            const parsedValue = JSON.parse(value);
            expect(parsedValue.default.data).toEqual(response); 
            expect(parsedValue.default.timestamp).toBeGreaterThan(0); 
        });
        
    
        it("should retrieve data from cache if available and not expired", async () => {
            const cachedResponse = { default: { data: { data: "cached data" }, timestamp: Date.now() }};
            mockStorage.getItem.mockResolvedValue(JSON.stringify(cachedResponse));
    
            sut = new AsyncSource(vi.fn(), vi.fn(), {
                requestCacheKey: "testKey",
                cacheStorage: mockStorage,
                cacheTime: 1000
            });
    
            await sut.update();
    
            expect(mockStorage.getItem).toHaveBeenCalledTimes(2);
            expect(mockStorage.getItem).toHaveBeenCalledWith(expect.stringContaining("AsyncSource-testKey"));
        });
    
        it("should not retrieve data from cache if expired", async () => {
            const expiredTimestamp = Date.now() - 2000; 
            const cachedResponse = { default: { data: { data: "cached data" }, timestamp: expiredTimestamp }};
            mockStorage.getItem.mockResolvedValue(JSON.stringify(cachedResponse));
    
            const response = { data: "fresh data" };
            const serviceMethod = vi.fn(() => Promise.resolve(response));
            sut = new AsyncSource(serviceMethod, vi.fn(), {
                requestCacheKey: "expired",
                cacheStorage: mockStorage,
                cacheTime: 1000
            });
    
            await sut.update();
            await delay(100)

            expect(sut.data).toEqual(response);
            expect(mockStorage.setItem).toHaveBeenCalledOnce();
            expect(serviceMethod).toHaveBeenCalledOnce();
        });
    
        it("should clear cache when calling clear method", async () => {
            sut = new AsyncSource(vi.fn(), vi.fn(), {
                requestCacheKey: "clear",
                cacheStorage: mockStorage
            });
    
            await sut.update();
            sut.clear();
    
            expect(mockStorage.removeItem).toHaveBeenCalledOnce();
            expect(mockStorage.removeItem).toHaveBeenCalledWith(expect.stringContaining("AsyncSource-clear"));
        });
    
        it("should use default storage if none provided", async () => {
            const response = { data: "default storage data" };
            const serviceMethod = vi.fn(() => Promise.resolve(response));
            const defaultStorageSetItemSpy = vi.spyOn(Storage.prototype, "setItem");

            sut = new AsyncSource(serviceMethod, vi.fn(), {
                requestCacheKey: "defaultStorage",
                cacheTime: 1000,
            });

            await sut.update();
        
            const [key1, value1] = defaultStorageSetItemSpy.mock.calls[0];

            expect(defaultStorageSetItemSpy).toHaveBeenCalledOnce();
            expect(key1).toContain("AsyncSource-defaultStorage");
            expect(JSON.parse(value1)).toEqual(expect.objectContaining({
                default: {
                    data: response,
                    timestamp: expect.any(Number)
                }
            }));
        
            defaultStorageSetItemSpy.mockRestore();
        });
        
        

        it("should store multiple cache entries under one key for different request args", async () => {
            const response = { data: "default storage data" };
            const serviceMethod = vi.fn(() => Promise.resolve(response));
            const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    
            sut = new AsyncSource(serviceMethod, vi.fn(), {
                requestCacheKey: "defaultKey",
                cacheTime: 1000,
            });
    
            await sut.update(1);
            await sut.update(2);
    
            expect(setItemSpy).toHaveBeenCalledTimes(2);
    
            const [cacheKey, storedValue] = setItemSpy.mock.calls[1];
            expect(cacheKey).toContain("AsyncSource-defaultKey");
    
            const parsed = JSON.parse(storedValue);
    
            expect(parsed).toEqual(expect.objectContaining({
                "[1]": {
                    data: response,
                    timestamp: expect.any(Number)
                },
                "[2]": {
                    data: response,
                    timestamp: expect.any(Number)
                }
            }));
    
            setItemSpy.mockRestore();
        });


        it("should update cache when isUpdateCache is true", async () => {
            const initialResponse = { data: "initial data" };
            const serviceMethod = vi.fn(() => Promise.resolve(initialResponse));
            const defaultStorageSetItemSpy = vi.spyOn(Storage.prototype, "setItem");
            const defaultStorageGetItemSpy = vi.spyOn(Storage.prototype, "getItem");

            sut = new AsyncSource(serviceMethod, vi.fn(), {
                requestCacheKey: "updateCacheKey",
                cacheTime: 1000,
                isUpdateCache: true, 
            });
        
            await sut.update(); 
            await sut.update(); 
        
            expect(serviceMethod).toHaveBeenCalledTimes(2); 
            expect(defaultStorageGetItemSpy).toHaveBeenCalledTimes(4); 
            expect(defaultStorageSetItemSpy).toHaveBeenCalledTimes(2); 
        });
        
        it("should not update cache when isUpdateCache is false", async () => {
            const initialResponse = { data: "initial data" };
            const serviceMethod = vi.fn(() => Promise.resolve(initialResponse));

            const defaultStorageSetItemSpy = vi.spyOn(Storage.prototype, "setItem");
            const defaultStorageGetItemSpy = vi.spyOn(Storage.prototype, "getItem")

            sut = new AsyncSource(serviceMethod, vi.fn(), {
                requestCacheKey: "notUpdateCacheKey",
                isUpdateCache: false, 

            });
        
            await sut.update(); 
            await sut.update(); 
            
            expect(serviceMethod).toHaveBeenCalledOnce(); 
            expect(defaultStorageSetItemSpy).toHaveBeenCalledOnce(); 
            expect(defaultStorageGetItemSpy).toHaveBeenCalledTimes(3); 
        });

        it("should successfully invalidate the cache key", async () => {
            const cacheKey = "testKey";
            const expectedKey = `AsyncSource-${cacheKey}`;
            const defaultStorageRemoveItemSpy = vi.spyOn(Storage.prototype, "removeItem");
        
            // Call the function
            await AsyncSource.invalidateCacheKey(cacheKey);
        
            // Assert that removeItem was called with the correct key
            expect(defaultStorageRemoveItemSpy).toHaveBeenCalledWith(expectedKey);
        });

        it("should successfully invalidate the cache key for not default storage", async () => {
            const cacheKey = "testKey";
            const expectedKey = `AsyncSource-${cacheKey}`;        
            // Call the function
            await AsyncSource.invalidateCacheKey(cacheKey, mockStorage);
        
            // Assert that removeItem was called with the correct key
            expect(mockStorage.removeItem).toHaveBeenCalledWith(expectedKey);
        });
    });
    describe("AsyncSource Cache Exception Handling", () => {
        let mockStorage: any;
        let sut: AsyncSource<any>;
    
        beforeEach(() => {
            mockStorage = createMockStorage();
            localStorage.clear();
        });
    
        afterEach(() => {
            vi.clearAllMocks();
        });
    
        it("should handle removeItem error in removeCachedData", async () => {
            const initialResponse = { data: "initial data" };
            const serviceMethod = vi.fn(() => Promise.resolve(initialResponse));
    
            mockStorage.removeItem.mockRejectedValueOnce(new Error("removeItem error"));
            
            sut = new AsyncSource(serviceMethod, vi.fn(), {
                requestCacheKey: "testRemoveError",
                cacheStorage: mockStorage
            });
            
            const consoleWarnSpy = vi.spyOn(console, "warn");
    
            await sut.update();
            sut.clear()
                    
            setTimeout(() => {
                expect(serviceMethod).toHaveBeenCalledOnce(); 
                expect(consoleWarnSpy).toHaveBeenCalledWith(expect.objectContaining({
                    message: "Cache removing error cacheKey:AsyncSource-testRemoveError",
                    error: expect.any(Error)
                }));
        
                consoleWarnSpy.mockRestore();
            }, 1000)
        });
    
        it("should handle getItem error in getCachedData", async () => {
            const initialResponse = { data: "initial data" };
            const serviceMethod = vi.fn(() => Promise.resolve(initialResponse));
    
            mockStorage.getItem.mockRejectedValueOnce(new Error("getItem error"));
            
            sut = new AsyncSource(serviceMethod, vi.fn(), {
                requestCacheKey: "testGetError",
                cacheStorage: mockStorage,
                cacheTime: 1000
            });
    
            sut["cacheKey"] = "AsyncSource-testGetError";
            
            const consoleWarnSpy = vi.spyOn(console, "warn");
    
            await sut.update();
            await sut.update();
    
            expect(serviceMethod).toHaveBeenCalledTimes(2); 
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.objectContaining({
                message: "Cache getting error cacheKey:AsyncSource-testGetError",
                error: expect.any(Error)
            }));
    
            consoleWarnSpy.mockRestore();
        });
    
        it("should handle setItem error in setCachedData", async () => {
            const initialResponse = { data: "initial data" };
            const serviceMethod = vi.fn(() => Promise.resolve(initialResponse));
    
            mockStorage.setItem.mockRejectedValueOnce(new Error("setItem error"));
            
            sut = new AsyncSource(serviceMethod, vi.fn(), {
                requestCacheKey: "testSetError",
                cacheStorage: mockStorage,
                cacheTime: 1000
            });
    
            const consoleWarnSpy = vi.spyOn(console, "warn");
    
            await sut.update();
    
            setTimeout(() => {
                expect(serviceMethod).toHaveBeenCalledOnce(); 
                expect(consoleWarnSpy).toHaveBeenCalledWith(expect.objectContaining({
                    message: 'Cache saving error cacheKey:AsyncSource-testSetError',
                    error: expect.any(Error)
                }));
        
                consoleWarnSpy.mockRestore();
            }, 1000)
        });

        it("should handle errors during cache invalidation", async () => {
            const cacheKey = "testKey";
            mockStorage.removeItem.mockRejectedValueOnce(new Error("Storage error"));

            // Spy on console.warn to ensure errors are logged
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        
            // Call the function
            await AsyncSource.invalidateCacheKey(cacheKey, mockStorage);
        
            // Assert that removeItem was called
            expect(mockStorage.removeItem).toHaveBeenCalledWith(`AsyncSource-${cacheKey}`);
        
            // Assert that console.warn was called to log the error
            expect(consoleWarnSpy).toHaveBeenCalledWith({
                message: `Cache invalidate error cacheKey:AsyncSource-${cacheKey}`,
                error: expect.any(Error),
            });
        
            // Clean up spy
            consoleWarnSpy.mockRestore();
        });

        it("should do nothing when no cache key is provided", async () => {        
            // Call the function with an empty cache key
            await AsyncSource.invalidateCacheKey("", mockStorage);
        
            // Assert that removeItem was not called
            expect(mockStorage.removeItem).not.toHaveBeenCalled();
        });
        
    });
});