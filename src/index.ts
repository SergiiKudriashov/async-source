interface AsyncStorage {
    getItem: (key: string) => Promise<string | undefined | null>;
    setItem: (key: string, value: string) => Promise<unknown>;
    removeItem: (key: string) => Promise<void>;
}

interface AsyncSourceConfig {
    storage?: CacheStorage;
    time?: number;
    prefix?: string;
}

interface AsyncSourceInstanceConfig {
    debounceTime?: number;
    cacheKey?: string;
    cacheTime?: number;
    storage?: CacheStorage;
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
    private storage: CacheStorage | null = null;
    private args: string = '';
    private static defaultCacheTime = 12 * 60 * 60 * 1000;
    private static defaultStorage: CacheStorage = localStorage;
    private static prefix = 'AsyncSource';

    constructor(
        serviceMethod: ServiceMethod<T>,
        errorHandler: ErrorHandler,
        debounceTime?: number,
        cacheKey?: string,
        cacheTime?: number,
        storage?: CacheStorage
    );

    constructor(
        serviceMethod: ServiceMethod<T>,
        errorHandler?: ErrorHandler,
        config?: AsyncSourceInstanceConfig,
    );

    constructor(
        serviceMethod: ServiceMethod<T>,
        errorHandler: ErrorHandler = () => {},
        debounceTimeOrConfig: DebounceTimeOrConfig = 100,
        cacheKey?: string,
        cacheTime: number = AsyncSource.defaultCacheTime,
        storage: CacheStorage = AsyncSource.defaultStorage
    ) {
        this.serviceMethod = serviceMethod;
        this.onError = errorHandler;

        if (typeof debounceTimeOrConfig === 'number') {
            this.debounceTime = debounceTimeOrConfig;
            this.cacheKey = cacheKey ? `${AsyncSource.prefix}-${cacheKey}` : undefined;
            this.cacheTime = cacheTime;
            this.storage = storage;
        } else {
            const {
                debounceTime = 100,
                cacheKey,
                cacheTime = AsyncSource.defaultCacheTime,
                storage = AsyncSource.defaultStorage
            } = debounceTimeOrConfig;

            this.debounceTime = debounceTime;
            this.cacheKey = cacheKey ?  `${AsyncSource.prefix}-${cacheKey}` : undefined;
            this.cacheTime = cacheTime;
            this.storage = storage;
        }
    }

    // Set cache config
    static setConfig(config: AsyncSourceConfig) {
        if (config.storage) {
            AsyncSource.defaultStorage = config.storage;
        }
        if (typeof config.time === 'number') {
            AsyncSource.defaultCacheTime = config.time;
        }
        if (config.prefix) {
            AsyncSource.prefix = config.prefix;
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
            await new Promise(resolve => setTimeout(resolve, 100));
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

        const cacheKey = this.getCacheKey();

        if (cacheKey) {
            new Promise((resolve) => resolve(this.storage?.removeItem(cacheKey)));
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

        if (this.args) {
            return `${this.cacheKey}-${this.args}`;
        }
        return this.cacheKey;
    }

    private async getCachedData(): Promise<PromiseResult<T> | null> {
        const cacheKey = this.getCacheKey();

        if (!cacheKey) return null;

        const storedData = await new Promise<string | null | undefined>((resolve) => resolve(this.storage?.getItem(cacheKey)));

        if (storedData) {
            try {
                const { data, timestamp } = JSON.parse(storedData);
                const isExpired = Date.now() - timestamp > this.cacheTime;
                return isExpired ? null : (data as PromiseResult<T>);
            } catch (error) {
                this.onError(error as Error);
            }
        }
        return null;
    }

    private setArgs(args: Array<any>) {
        if (args) {
            try {
                this.args = JSON.stringify(args);
            } catch (error) {
                this.onError(error as Error);
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
            new Promise((resolve) => resolve(this.storage?.setItem(cacheKey, JSON.stringify(cacheValue))));
        } catch (error) {
            this.onError(error as Error);
        }
    }

    private async request(args: Array<any>, successHandler?: (response: T) => void, isImmediate?: boolean): Promise<void> {
        this.setArgs(args);

        const cacheKey = this.getCacheKey();

        this.loadFromStorage();

        if (cacheKey && this.responseData && !this.isRequestPending) {
            this.isFetchedData = true;
            successHandler?.(this.responseData);
        }

        this.isRequestPending = true;

        const requestId = await this.createRequestId(isImmediate);
        if (!this.isLastRequest(requestId)) return;

        try {
            const response = await this.serviceMethod(...args);
            if (this.isLastRequest(requestId)) {
                this.isRequestPending = false;
                this.isFetchedData = true;
                this.responseData = response;
                successHandler?.(response);

                if (cacheKey) {
                    this.setCachedData(response);
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
