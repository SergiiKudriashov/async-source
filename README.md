# AsyncSource

`AsyncSource` is a stateful, reactive data source designed for managing asynchronous requests in modern JavaScript and TypeScript projects. It provides robust features for error handling, throttling, and caching, making it ideal for applications that require efficient data management.

### Features
**Stateful Management:** Track the state of your requests, including (`isLoading`, `isFetched`, `data`).

**Error Handling:** Automatically manage errors with customizable handlers, ensuring a smooth user experience.

**Debounce Control:** Integrate built-in debouncing to manage rapid requests, preventing redundant calls and ensuring only the latest call is processed.

**Cache Support:** Cache responses locally with configurable storage options and expiration times, enhancing performance and reducing unnecessary network requests.

**Automatic State Consistency:** In cases of multiple calls, only the last call will be processed, maintaining data integrity and consistency.

### Use Cases

- Connect `AsyncSource` to dynamic selects to efficiently handle user interactions and data fetching.
- Implement throttling and debouncing in applications that require real-time data updates without overwhelming the server.

### Install ###
```
npm install --save async-source
```


### Usage ###
```javascript
// javascript
import AsyncSource from 'async-source';

const source = new AsyncSource(request);

async function loadItems() {
    await source.update(...requestParams);
    const response = source.data;
}
```

```typescript
// typescript
import AsyncSource from 'async-source';

const source = new AsyncSource<RespnonsType>(request);

async function loadItems() {
    await source.update(...requestParams);
    const response = source.data;
}
```

#### Parameters ###
**Parameter** | **Is required** | **Description**
--- | --- | ---
serviceMethod | true | Method that returns promise
errorHandler | false | Function that will be called in case of service method rejected
delay | false | delay in ms

#### Properties(reactive getters) ####
**Property** | **Description** | **Type**
--- | --- | ---
data | Returns your method response | Your method response
isLoading | Returns *true* when request pending | Boolean
isFetch | Returns *true* after first load | Boolean

#### Methods ####
**Method** | **Description**                                                                   | **Params**
--- |-----------------------------------------------------------------------------------| ---
update | Calls be request                                                                  | Your method request params
push | Calls be request and handles success response                                     | Success handler, Your method request params
updateIfEmpty | Calls be request in source if data is empty                                       | Your method request params
updateOnce | Calls be request in source if data is empty and waits till other request resolved | Your method request params
updateImmediate | Calls be request in source ignoring debounce                                      | Your method request params
clear | Set source data to initial state(*null*)                                          | ---

#### Usage with vue3(composition api) ####
```vue
<template>
    <ul v-loading="isLoading">
        <li v-for="item in items" :key="item.id">
            {{ item.name }}
        </li>
    </ul>
</template>

<script>
import AsyncSource from 'async-source';
import { computed, reactive } from 'vue';

export default {
    name: 'MyComponent',
    setup() {
        function errorHandler(error) {
            console.error(error);
        }

        const source = reactive(new AsyncSource(request, errorHandler, 300));

        source.update();

        const items = computed(() => source.data || []);
        const isLoading = computed(() => source.isLoading);
        
        return {
            items,
            isLoading
        };
    }
}

</script>
```

#### Usage with vue2(option api) ####
```vue
<template>
    <ul v-loading="isLoading">
        <li v-for="item in items" :key="item.id">
            {{ item.name }}
        </li>
    </ul>
</template>

<script>
import AsyncSource from 'async-source';

export default {
    name: 'MyComponent',
    data() {
        return {
            source: new AsyncSource(request, this.errorHandler, 300)
        }
    },
    computed: {
        items() {
            return this.source.data || [];
        },
        isLoading() {
            return this.source.isLoading;
        }
    },
    created() {
        this.source.update();
    },
    methods: {
        errorHandler(error) {
            console.error(error);
        }
    }
}

</script>
```

### Cache ###
#### Global cache configuration ####
##### To apply global settings, use setConfig: #####
```js
import AsyncSource from 'async-source';

AsyncSource.setConfig({
    cacheStorage: localStorage,               // or any custom sync/async storage
    cacheTime: 12 * 60 * 60 * 1000,           // cache for 12 hours
    cachePrefix: 'MyAppAsyncSource'            // optional prefix for cache keys
});
```

#### Instance-Level Configuration ####
##### Specify custom settings for each AsyncSource instance by passing an options object as the third parameter. This object can include both caching and debounce settings. #####

```typescript
new AsyncSource<T>(
    serviceMethod: (...args: any[]) => Promise<T>,
    errorHandler?: (error: any) => void,
    configOrDelay?: number | ConfigOptions
)
```

| Parameter | Required | Description |
| --- | --- | --- |
| `serviceMethod` | Yes | Method that returns a promise. |
| `errorHandler` | No | Function to handle errors in the service method. |
| `configOrDelay` | No | Debounce delay (in ms) or an object with config options. |


#### ConfigOptions Interface ####
##### If using a configuration object for configOrDelay, it can include: #####
```typescript
interface ConfigOptions {
    debounceTime?: number;        // Delay before request execution (in milliseconds)
    requestCacheKey?: string;     // Request cache key (required for enable cache)
    cacheTime?: number;           // Cache expiration in milliseconds
    cacheStorage?: CacheStorage;  // Storage (e.g., localStorage, sessionStorage, indexDB)
    isUpdateCache?: boolean;      // Refetch cache every time when true.
}
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `debounceTime` | `number` | `300` | Delay before request execution (in milliseconds). |
| `requestCacheKey` | `string` |  | Request cache key (required for enabling cache). |
| `cacheTime` | `number` | `43200000` | Cache expiration time in milliseconds (default: 12 hours). |
| `cacheStorage` | `CacheStorage` | `localStorage` | Storage interface (e.g., localStorage, sessionStorage, indexedDB). |
| `isUpdateCache` | `boolean` | `true` | Refetch cache every time when true. |

### AsyncSource.invalidateCacheKey

Invalidates (removes) the cache entry associated with the provided cache key.

This method removes the cached data from the storage based on the provided `cacheKey` and the `cachePrefix`. The key used to identify the cached data is a combination of `cachePrefix` and the provided `cacheKey`. If the cache item exists in the storage, it will be removed. If an error occurs during the removal, it will be caught and logged, and the method will return `null`.

#### Parameters

- **`cacheKey`** (`string`): The key used to identify the cached data to be invalidated. This value is combined with the `cachePrefix` to form the full cache key.
- **`storage`** (`CacheStorage`, optional): The storage where the cache is stored. If not provided, the default storage (`AsyncSource.defaultStorage`) will be used.

#### Returns

- **`Promise<void | null>`**: A promise that resolves to `void` if the cache entry was successfully invalidated, or `null` if an error occurred during the removal.

#### Example

```typescript
// Example usage:
await AsyncSource.invalidateCacheKey("myCacheKey");

// You can also provide a custom storage:
await AsyncSource.invalidateCacheKey("myCacheKey", customStorage);
```


#### Example ####

#### Sync storage ###
```vue
<template>
    <ul v-loading="isLoading">
        <li v-for="item in items" :key="item.id">
            {{ item.name }}
        </li>
    </ul>
</template>

<script>
import AsyncSource from 'async-source';
import { computed, reactive } from 'vue';

export default {
    name: 'MyComponent',
    setup() {
        function errorHandler(error) {
            console.error(error);
        }

        const source = reactive(
            new AsyncSource(request, errorHandler, {
                requestCacheKey: 'key',
                cacheStorage: sessionStorage,
                isUpdateCache: false,
                debounceTime: 100,
                cacheTime: 24 * 60 * 60 * 1000 // 24h
            })
        );
        source.update();

        const items = computed(() => source.data || []);
        const isLoading = computed(() => source.isLoading);
        
        return {
            items,
            isLoading
        };
    }
}

</script>
```

#### Async storage ###
```vue
<template>
    <ul v-loading="isLoading">
        <li v-for="item in items" :key="item.id">
            {{ item.name }}
        </li>
    </ul>
</template>

<script>
import AsyncSource from 'async-source';
import { computed, reactive } from 'vue';
import { get, set, del } from 'idb-keyval';

export default {
    name: 'MyComponent',
    setup() {
        function errorHandler(error) {
            console.error(error);
        }

        const storage = {
            getItem: (key: string) => get(key),
            setItem: (key: string, value: string) => set(key, value),
            removeItem: (key: string) => del(key)
        };

        const source = reactive(
            new AsyncSource(request, errorHandler, {
                requestCacheKey: 'key',
                cacheStorage: storage,
                isUpdateCache: false,
                debounceTime: 100,
                cacheTime: 24 * 60 * 60 * 1000 // 24h
            })
        );
        source.update();

        const items = computed(() => source.data || []);
        const isLoading = computed(() => source.isLoading);
        
        return {
            items,
            isLoading
        };
    }
}

</script>
```