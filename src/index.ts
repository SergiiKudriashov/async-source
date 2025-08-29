type PromiseResult<T> = T extends PromiseLike<infer U> ? U : T;
export type ResponseData<T> = T;
export type ServiceMethod<T = any, TArgs extends Array<any> = Array<any>> = (...args: TArgs) => Promise<T>;
export type SuccessHandler<T> = (response: T) => unknown | Promise<unknown>;
export type ErrorHandler = (error: any) => void;

class AsyncSource<T, TArgs extends Array<any> = Array<any>> {
    readonly onError: ErrorHandler;
    readonly serviceMethod: ServiceMethod<T, TArgs>;
    readonly debounceTime: number;
    private responseData: PromiseResult<ReturnType<ServiceMethod>> = null;
    private isRequestPending = false;
    private isFetchedData = false;
    private lastRequestId = 0;

    constructor(
        serviceMethod: ServiceMethod<T, TArgs>,
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
    public async update(...args: TArgs): Promise<void> {
        await this.request(args);
    }

    // Loads new dataSouse data if data is empty
    public async updateIfEmpty(...args: TArgs): Promise<void> {
        if (this.data) return;
        await this.request(args);
    }

    public async updateOnce(...args: TArgs): Promise<void> {
        if (this.isLoading) {
            await new Promise(resolve => setTimeout(resolve, 100));
            await this.updateOnce(...args);
        } else {
            await this.updateIfEmpty(...args);
        }
    }

    // Loads new dataSouse data ignoring debounce time
    public async updateImmediate(...args: TArgs): Promise<void> {
        await this.request(args, undefined, true);
    }

    // Loads new dataSouse data and calls successHandler with response
    async push(successHandler: SuccessHandler<T>, ...args: TArgs): Promise<void> {
        await this.request(args, successHandler);
    }

    // Clear source data
    clear(): void {
        this.isRequestPending = false;
        this.isFetchedData = false;
        this.responseData = null;
        this.lastRequestId = 0;
    }

    // Core request method
    private async request(args: TArgs, successHandler?: SuccessHandler<T>, isImmediate?: boolean) {
        this.isRequestPending = true;

        const requestId = await this.createRequestId(isImmediate);
        if (!this.isLastRequest(requestId)) return;

        try {
            const response = await this.serviceMethod(...args);
            if (this.isLastRequest(requestId)) {
                this.isRequestPending = false;
                this.isFetchedData = true;
                this.responseData = response;
                await successHandler?.(response);
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
