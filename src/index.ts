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
    private cacheKey?: string;
    private cacheTime: number;
    private cacheStorage: CacheStorage | null = null;
    private requestParams = '';
    private isUpdateRequestCache = true;
    private static defaultCacheTime = 12 * 60 * 60 * 1000;
    private static defaultStorage: CacheStorage = localStorage;
    private static cachePrefix = 'AsyncSource';

    constructor(
        serviceMethod: ServiceMethod<T>,
        errorHandler: ErrorHandler,
        debounceTime?: number,
        requestCacheKey?: string,
        cacheTime?: number,
        cacheStorage?: CacheStorage,
        isUpdateCache?: boolean
    );

    constructor(
        serviceMethod: ServiceMethod<T>,
        errorHandler?: ErrorHandler, 
        config?: AsyncSourceInstanceConfig
    );

    constructor(
        serviceMethod: ServiceMethod<T>,
        errorHandler: ErrorHandler = () => {},
        debounceTimeOrConfig: DebounceTimeOrConfig = 100,
        requestCacheKey?: string,
        cacheTime: number = AsyncSource.defaultCacheTime,
        cacheStorage: CacheStorage = AsyncSource.defaultStorage,
        isUpdateCache = true
    ) {
        this.serviceMethod = serviceMethod;
        this.onError = errorHandler;

        if (typeof debounceTimeOrConfig === 'number') {
            this.debounceTime = debounceTimeOrConfig;
            this.cacheKey = requestCacheKey ? `${AsyncSource.cachePrefix}-${requestCacheKey}` : undefined;
            this.cacheTime = cacheTime;
            this.cacheStorage = cacheStorage;
            this.isUpdateRequestCache = isUpdateCache;
        } else {
            const {
                debounceTime = 100,
                requestCacheKey,
                cacheTime = AsyncSource.defaultCacheTime,
                cacheStorage = AsyncSource.defaultStorage,
                isUpdateCache = true
            } = debounceTimeOrConfig;

            this.debounceTime = debounceTime;
            this.cacheKey = requestCacheKey ? `${AsyncSource.cachePrefix}-${requestCacheKey}` : undefined;
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
        this.requestParams = '';

        const cacheKey = this.getCacheKey();

        if (cacheKey) {
            new Promise((resolve) => resolve(this.cacheStorage?.removeItem(cacheKey)));
        }
    }

    private async loadFromStorage() {
        const cachedData = await this.getCachedData();
        if (cachedData) {
            this.responseData = cachedData;
            this.isFetchedData = true;
            this.isRequestPending = false;
        }
    }

    private getCacheKey() {
        if (!this.cacheKey) return;

        if (this.requestParams) {
            return `${this.cacheKey}-${this.requestParams}`;
        }
        return this.cacheKey;
    }

    private async getCachedData(): Promise<PromiseResult<T> | null> {
        const cacheKey = this.getCacheKey();

        if (!cacheKey) return null;

        const storedData = await new Promise<string | null | undefined>((resolve) => resolve(this.cacheStorage?.getItem(cacheKey)));

        if (storedData) {
            try {
                const { data, timestamp } = JSON.parse(storedData);
                const isExpired = Date.now() - timestamp > this.cacheTime;
                return isExpired ? null : (data as PromiseResult<T>);
            } catch (error) {
                console.warn({ message: `Cache getting error cacheKey:${cacheKey}`, error });
            }
        }
        return null;
    }

    private setRequestParams(requestParams: Array<any>) {
        if (requestParams.length > 0) {
            try {
                this.requestParams = JSON.stringify(requestParams);
            } catch (error) {
                console.warn({ message: `Request params saving error cacheKey:${this.cacheKey}`, params: requestParams, error });
            }
        }
    }

    private setCachedData(data: T): void {
        const cacheKey = this.getCacheKey();

        if (!cacheKey) return;

        const cacheValue = {
            data,
            timestamp: Date.now()
        };

        try {
            new Promise((resolve) => resolve(this.cacheStorage?.setItem(cacheKey, JSON.stringify(cacheValue))));
        } catch (error) {
            console.warn({ message: `Cache saving error cacheKey:${cacheKey}`, error });
        }
    }

    private async request(args: Array<any>, successHandler?: (response: T) => void, isImmediate?: boolean): Promise<void> {
        this.isRequestPending = true;

        const requestId = await this.createRequestId(isImmediate);
        if (!this.isLastRequest(requestId)) return;

        if (this.cacheKey) {
            this.setRequestParams(args);

            const cacheKey = this.getCacheKey();

            await this.loadFromStorage();

            if (cacheKey && this.responseData && !this.isRequestPending) {
                this.isFetchedData = true;
                successHandler?.(this.responseData);
                if (!this.isUpdateRequestCache) return;
            }
        }

        try {
            const response = await this.serviceMethod(...args);
            if (this.isLastRequest(requestId)) {
                this.isRequestPending = false;
                this.isFetchedData = true;
                this.responseData = response;
                successHandler?.(response);

                const cacheKey = this.getCacheKey();

                if (cacheKey) {
                    this.setCachedData(response);
                }
            }
        } catch (error) {
            if (this.isLastRequest(requestId)) {
                this.isRequestPending = false;
                this.isFetchedData = true;
                this.responseData = null;
                this.requestParams = '';
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
