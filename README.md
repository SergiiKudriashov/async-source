#AsyncSource
With AsyncSource you can
* Create stateful reactive data source for asynchronous requests
* Handle errors
* Configure throttling
* Ignore inconsistent state
* Control state of your requests (isLoading, isFetch, data)

In case of multiple calls - only last call will be processed.
Connect AsyncSource to your dynamic selects with in build debounce

###Install
```
npm install --save async-source
```


###Usage
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

####Parameters
**Parameter** | **Is required** | **Description**
--- | --- | ---
serviceMethod | true | Method that returns promise
errorHandler | false | Function that will be called in case of service method rejected
delay | false | delay in ms
####Properties(reactive getters)
**Property** | **Description** | **Type**
--- | --- | ---
data | Returns your method response | Your method response
isLoading | Returns *true* when request pending | Boolean
isFetch | Returns *true* after first load | Boolean
####Methods
**Method** | **Description** | **Params**
--- | --- | ---
update | Calls be request | Your method request params
push | Calls be request and handles success response | Success handler, Your method request params
updateIfEmpty | Calls be request in source data is empty  | Your method request params
clear | Set source data to initial state(*null*) | ---

####Usage with vue3(composition api)
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

####Usage with vue2(option api)
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
