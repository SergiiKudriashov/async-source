class AsyncSource<T>{
    private responseData: T|null;
    private isRequestPending: boolean;
    private isFetchedData: boolean;
    private lastRequestId: number|null;
    readonly onError: Function;
    readonly serviceMethod: (...args: Array<unknown>) => Promise<T>;
    readonly debounceTime: number;

    constructor(serviceMethod: (...args: Array<unknown>) => Promise<T>, errorHandler = () => {}, debounceTime = 100) {
        this.responseData = null;
        this.isRequestPending = false;
        this.isFetchedData = false;

        this.serviceMethod = serviceMethod;
        this.debounceTime = debounceTime;
        this.lastRequestId = null;
        this.onError = errorHandler;
    }
    // Response data getter
    get data() {
        return this.responseData;
    }
    // Is loading state getter
    get isLoading() {
        return this.isRequestPending;
    }
    // Is fetched once state getter
    get isFetch() {
        return this.isFetchedData;
    }

    // Loads new dataSouse data
    async update(...args: Array<unknown>): Promise<void> {
        await this.request(args, null);
    }

    // Loads new dataSouse data if data is empty
    async updateIfEmpty(...args: Array<unknown>): Promise<void> {
        if (this.data) return;
        await this.request(args, null);
    }

    // Loads new dataSouse data and calls successHandler with response
    async push(successHandler: (response: T) => unknown, ...args: Array<unknown>): Promise<void> {
        await this.request(args, successHandler);
    }

    // Clear source data
    clear(): void {
        this.responseData = null;
    }

    // Core request method
    private async request(args: Array<unknown>, successHandler: ((response: T) => void) | null) {
        this.isRequestPending = true;

        const requestId = await this.createRequestId();
        if (!this.isLastRequest(requestId)) return;

        try {
            const response = await this.serviceMethod(...args);
            if (this.isLastRequest(requestId)) {
                this.isRequestPending = false;
                this.isFetchedData = true;
                this.responseData = response;
                if (successHandler) successHandler(response);
            }
        } catch (error) {
            if (this.isLastRequest(requestId)) {
                this.isRequestPending = false;
                this.isFetchedData = true;
                this.responseData = null;
                this.onError(error);
            }
        }
    }

    private createRequestId(): Promise<number> {
        const isFirstRequest = !this.lastRequestId;
        const requestId = Date.now();
        this.lastRequestId = requestId;
        if (isFirstRequest) {
            return new Promise(resolve => resolve(requestId));
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
