type PromiseResult<T> = T extends PromiseLike<infer U> ? U : T;
export type ResponseData<T> = T|null;
export type ServiceMethod<T = any> = (...args: Array<any>) => Promise<T>;
export type ErrorHandler = (error: Error & any) => void;

class AsyncSource<T>{
    readonly onError: ErrorHandler;
    readonly serviceMethod: ServiceMethod<T>;
    readonly debounceTime: number;
    private responseData: PromiseResult<ReturnType<ServiceMethod>> = null;
    private isRequestPending = false;
    private isFetchedData = false;
    private lastRequestId: number|null = null;

    constructor(serviceMethod: ServiceMethod<T>, errorHandler: ErrorHandler = () => {}, debounceTime = 100) {
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
    public update(...args: Array<any>): Promise<void | T> {
        return this.request(args);
    }

    // Loads new dataSouse data if data is empty
    public updateIfEmpty(...args: Array<any>): Promise<void | T> {
        if (this.data) return Promise.resolve();
        return this.request(args);
    }

    // Loads new dataSouse data ignoring debounce time
    public updateImmediate(...args: Array<any>): Promise<void | T> {
        return this.request(args, undefined, true);
    }

    // Loads new dataSouse data and calls successHandler with response
    push(successHandler: (response: T) => unknown, ...args: Array<any>): Promise<void | T> {
        return this.request(args, successHandler);
    }

    // Clear source data
    clear(): void {
        this.responseData = null;
        this.isFetchedData = false;
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

            return response;
        } catch (error) {
            if (this.isLastRequest(requestId)) {
                this.isRequestPending = false;
                this.isFetchedData = true;
                this.responseData = null;
                this.onError?.(error);
            }

            throw error;
        }
    }

    private createRequestId(isImmediate?: boolean): Promise<number> {
        const isFirstRequest = !this.lastRequestId;
        const requestId = Date.now();
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
