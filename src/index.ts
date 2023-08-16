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
    private lastRequestId: number = 0;

    constructor(
        serviceMethod: ServiceMethod<T>,
        errorHandler: ErrorHandler = () => {},
        debounceTime = 100
    ) {
        this.serviceMethod = serviceMethod;
        this.debounceTime = debounceTime;
        this.onError = errorHandler;
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
        this.isFetchedData = false;
        this.responseData = null;
        this.lastRequestId = 0;
    }

    // Core request method
    private async request(args: Array<any>, successHandler?: ((response: T) => void), isImmediate?: boolean) {
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

        return new Promise(resolve => setTimeout(() => {
            resolve(requestId);
        }, this.debounceTime));
    }

    private isLastRequest(requestId: number): boolean {
        return requestId === this.lastRequestId;
    }
}

export default AsyncSource;
