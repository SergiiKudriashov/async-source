interface AsyncStorage {
    getItem: (key: string) => Promise<string | undefined | null>;
    setItem: (key: string, value: string) => Promise<unknown>;
    removeItem: (key: string) => Promise<void>;
}

interface AsyncSourceConfig {
    cacheStorage?: CacheStorage;
    cacheTime?: number;
    cachePrefix?: string;
}

interface AsyncSourceInstanceConfig {
    debounceTime?: number;
    requestCacheKey?: string;
    cacheTime?: number;
    cacheStorage?: CacheStorage;
    isUpdateCache?: boolean;
}

type CacheStorage = AsyncStorage | Storage | undefined | null;
type DebounceTimeOrConfig = number | AsyncSourceInstanceConfig;
type PromiseResult<T> = T extends PromiseLike<infer U> ? U : T;
export type ResponseData<T> = T;
export type ServiceMethod<T = any> = (...args: Array<any>) => Promise<T>;
export type ErrorHandler = (error: Error) => void;

class AsyncSource<T> {
    readonly onError: ErrorHandler;
    readonly serviceMethod: ServiceMethod<T>;
    readonly debounceTime: number;
    private responseData: PromiseResult<ReturnType<ServiceMethod>> = null;
    private isRequestPending = false;
    private isFetchedData = false;
    private lastRequestId = 0;
    private requestCacheKey?: string;
    private isCacheEnabled = false;
    private cacheTime!: number;
    private cacheStorage: CacheStorage | null = null;
    private isUpdateRequestCache = true;
    private cacheKey?: string;
    private static defaultCacheTime = 12 * 60 * 60 * 1000;
    private static defaultStorage: CacheStorage = localStorage;
    private static cachePrefix = 'AsyncSource';

    constructor(serviceMethod: ServiceMethod<T>, errorHandler?: ErrorHandler, debounceTime?: number);

    constructor(serviceMethod: ServiceMethod<T>, errorHandler?: ErrorHandler, config?: AsyncSourceInstanceConfig);

    constructor(serviceMethod: ServiceMethod<T>, errorHandler: ErrorHandler = () => {}, debounceTimeOrConfig: DebounceTimeOrConfig = 100) {
        this.serviceMethod = serviceMethod;
        this.onError = errorHandler;

        if (typeof debounceTimeOrConfig === 'number') {
            this.debounceTime = debounceTimeOrConfig;
        } else {
            const {
                debounceTime = 100,
                requestCacheKey,
                cacheTime = AsyncSource.defaultCacheTime,
                cacheStorage = AsyncSource.defaultStorage,
                isUpdateCache = true
            } = debounceTimeOrConfig;

            this.debounceTime = debounceTime;
            this.isCacheEnabled = Boolean(requestCacheKey);
            this.requestCacheKey = requestCacheKey;
            this.cacheTime = cacheTime;
            this.cacheStorage = cacheStorage;
            this.isUpdateRequestCache = isUpdateCache;
        }
    }

    // Set cache config
    static setConfig(config: AsyncSourceConfig) {
        if (config.cacheStorage) {
            AsyncSource.defaultStorage = config.cacheStorage;
        }
        if (typeof config.cacheTime === 'number') {
            AsyncSource.defaultCacheTime = config.cacheTime;
        }
        if (config.cachePrefix) {
            AsyncSource.cachePrefix = config.cachePrefix;
        }
    }

    // Response data getter
    public get data(): ResponseData<T> {
        return this.responseData;
    }

    // Is loading state getter
    public get isLoading() {
        return this.isRequestPending;
    }

    // Is fetched once state getter
    public get isFetch() {
        return this.isFetchedData;
    }

    // Loads new dataSouse data
    public async update(...args: Array<any>): Promise<void> {
        await this.request(args);
    }

    // Loads new dataSouse data if data is empty
    public async updateIfEmpty(...args: Array<any>): Promise<void> {
        if (this.data) return;
        await this.request(args);
    }

    public async updateOnce(...args: Array<any>): Promise<void> {
        if (this.isLoading) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            await this.updateOnce(...args);
        } else {
            await this.updateIfEmpty(...args);
        }
    }

    // Loads new dataSouse data ignoring debounce time
    public async updateImmediate(...args: Array<any>): Promise<void> {
        await this.request(args, undefined, true);
    }

    // Loads new dataSouse data and calls successHandler with response
    async push(successHandler: (response: T) => unknown, ...args: Array<any>): Promise<void> {
        await this.request(args, successHandler);
    }

    // Clear source data
    clear(): void {
        this.isRequestPending = false;
        this.isFetchedData = false;
        this.responseData = null;
        this.lastRequestId = 0;
        this.removeCachedData();
    }

    private async syncCache(args: Array<any>) {
        this.updateCacheKey(args);

        const cachedData = await this.getCachedData();
        if (cachedData) {
            this.responseData = cachedData;
            this.isFetchedData = true;
            this.isRequestPending = false;
        }
    }

    private updateCacheKey(requestParams: Array<any>) {
        const baseCacheKey = `${AsyncSource.cachePrefix}-${this.requestCacheKey}`;

        const isRequestParamsExist = Boolean(requestParams.length);

        let requestParamsHash;

        if (isRequestParamsExist) {
            try {
                requestParamsHash = JSON.stringify(requestParams);
            } catch (error) {
                console.warn({ message: `Request params saving error cacheKey:${baseCacheKey}`, params: requestParams, error });
            }
        }

        this.cacheKey = requestParamsHash ? `${baseCacheKey}-${requestParamsHash}` : baseCacheKey;
    }

    private removeCachedData() {
        try {
            if (this.cacheKey) {
                this.cacheStorage?.removeItem?.(this.cacheKey);
            }
        } catch (error) {
            console.warn({ message: `Cache removing error cacheKey:${this.cacheKey}`, error });
        }
    }

    private async getCachedData(): Promise<PromiseResult<T> | null> {
        if (!this.cacheKey) return null;

        try {
            const storedData = await this.cacheStorage?.getItem?.(this.cacheKey);

            if (storedData) {
                const { data, timestamp } = JSON.parse(storedData);
                const isExpired = Date.now() - timestamp > this.cacheTime;
                return isExpired ? null : (data as PromiseResult<T>);
            }

            return null;
        } catch (error) {
            console.warn({ message: `Cache getting error cacheKey:${this.cacheKey}`, error });
            return null;
        }
    }

    private async setCachedData(data: T): Promise<void> {
        if (!this.cacheKey) return;

        const cacheValue = {
            data,
            timestamp: Date.now()
        };

        try {
           await this.cacheStorage?.setItem?.(this.cacheKey, JSON.stringify(cacheValue));
        } catch (error) {
            console.warn({ message: `Cache saving error cacheKey:${this.cacheKey}`, error });
        }
    }

    private async request(args: Array<any>, successHandler?: (response: T) => void, isImmediate?: boolean): Promise<void> {
        this.isRequestPending = true;

        const requestId = await this.createRequestId(isImmediate);
        if (!this.isLastRequest(requestId)) return;

        if (this.isCacheEnabled) {
            await this.syncCache(args);

            if (this.responseData && !this.isRequestPending) {
                this.isFetchedData = true;
                successHandler?.(this.responseData);

                if (!this.isUpdateRequestCache) {
                    return;
                }
            }
        }

        try {
            const response = await this.serviceMethod(...args);
            if (this.isLastRequest(requestId)) {
                this.isRequestPending = false;
                this.isFetchedData = true;
                this.responseData = response;
                successHandler?.(response);

                if (this.isCacheEnabled) {
                    await this.setCachedData(response);
                }
            }
        } catch (error) {
            if (this.isLastRequest(requestId)) {
                this.isRequestPending = false;
                this.isFetchedData = true;
                this.responseData = null;
                this.onError(error as Error);
            }
        }
    }

    private createRequestId(isImmediate?: boolean): Promise<number> {
        const isFirstRequest = !this.lastRequestId;
        const requestId = this.lastRequestId + 1;
        this.lastRequestId = requestId;
        if (isFirstRequest || isImmediate) {
            return Promise.resolve(requestId);
        }

        return new Promise((resolve) => setTimeout(resolve, this.debounceTime, requestId));
    }

    private isLastRequest(requestId: number): boolean {
        return requestId === this.lastRequestId;
    }
}

export default AsyncSource;
