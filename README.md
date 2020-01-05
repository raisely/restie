# Restie

Restie is a restful-js/restangular inspired REST wrapper for `fetch` implementations, but without mutative effects.


## Installing

`npm i -S @raisely/restie`


### Do No Harm License

Restie uses a non standardized software license called **Do No Harm**, which helps promote ethical use of this software, and at best, helps prevent non-ethically positioned third-parties from adopting it.

Clause 9 of [The Open Source Definition](https://opensource.org/osd) states that you are free to use this software, along with this license with any currently [approved OSI-compatible licenses](https://opensource.org/licenses/alphabetical); making it compatible with existing open software solutions already in your project. This license only limits inclusion based on the actual project being developed.

> The license must not place restrictions on other software that is distributed along with the licensed software. For example, the license must not insist that all other programs distributed on the same medium must be open-source software.


## Usage

Restie uses an `api -> model -> method` syntax, with support for nested model accessing. Restie acts as a means of delegating and representing most existing api paths and methods as reusable models.

The example below shows the model representation of crayons in specific boxes, as well as the creation of a new crayon entity within that subset.

```js
import restie from '@raisely/restie';

// build client interface
const crayons = restie('https://yourapi.test')
    // the box (of boxes) and one with the id of current
    .one('boxes', 'current')
    // get all crayons in that box (as a sub api)
    .all('crayons');

// create a new crayon in the current box
const response = await crayons.post({
    color: 'red',
    size: 'small',
});
```


### Building a rest model

Rest models in Restie are static representations of a remote api and endpoint, and are best used as a means of creating **reusable** interfaces between a client and a remote REST api.

```js
import restie from '@raisely/restie';

// build client interface
const crayons = restie('https://yourapi.test')
    // the box (of boxes) and one with the id of current
    .one('boxes', 'current')
    // get all crayons in that box (as a sub api)
    .all('crayons');
```


#### Accessing higher-level models

Restie models, when used correctly, can also give access to parent model interfaces via the `parent()` method. This is intended to make accessing and mapping a higher level api much more accessible.

```js
import restie from '@raisely/restie';

// build client interface
const crayons = restie('https://yourapi.test')
    .one('boxes', 'current')
    .all('crayons');

// create a model representing the current box (up a level)
const currentBox = crayons.parent();

// create a model representing the RESTful interface for all boxes (up a level)
const allBoxes = currentBox.parent();
````


#### Model methods

Once a model is created, additional methods are exposed for communicating intents with remote models.

| Method | Description |
| --- | --- |
| `.get(slug?, query, headers)` | will retrieve the current remote representation of a given model from the remote api. |
| `.post(data, query, headers)` | creates a new entity on the remote api based on the `data` object passed. |
| `.put(slug?, data, query, headers)` | will update an existing entity on the remote api with the `data` object passed. |
| `.patch(slug?, data, query, headers)` | _see `.put`_ |
| `.delete(slug?, data, query, headers)` | will remove the provided entity from the remote api. |


#### Model method parameter overview

| Name | Parameter Type | Description |
| --- | --- | --- |
| `slug` | `string \| number` | value representing a direct or nested resource under a given model. I.e `'thing-nested'` or `102`. |
| `data` | `object (plain)` | JSON representation of the payload to send up with a restful request. |
| `query` | `object (plain)` | Key-value representation of the various query parameters to bind to a given resource when sending it up the wire. By default, Restie expects the `qs` package for serializing query parameters. |
| `headers` | `object (plain)` | Key-value representation of the request header that is sent up the wire by default, this will contain `Content-Type` and `Accept` values that can be overridden as needed. |


## Advanced usage

Restie also provides additional opt-in behaviors that can help alleviate some more complicated problems.

### Using custom interceptors

Restie provides a means to intercept and mutate the configurations used before making an outgoing request, as well as mutating the resulting payload before it's returned back from a model method. This can be useful when consolidating api logic between requests, and when extending default Restie behaviors.

#### Intercepting request options

By using request interceptors, it's possible to attach custom headers, add query parameters, reassign methods, and even
mutate the passed body object before a request is sent out to the server.

```js
const yourApi = restie('https://yourapi.test')

const customInterceptor = options => ({
    headers: {
        // preserve existing headers (not a deep merge!)
        ...options.headers,
        // add in your cool custom header (with each request)
        'your-cool-custom-header': 'enable'
    },
    // also supports params, method, and body (for supported requests)
});

// add the interceptor to the restie api.
// each following request will now include your custom header
yourApi.addRequestInterceptor(customInterceptor);

// removing the interceptor is just as easy (like an event handler)
yourApi.removeRequestInterceptor(customInterceptor);
````

#### Intercepting the resulting payload

By using response interceptors, it's possible to mutate the the processed result from the remote api before it is succesffuly return to it's calling code.

```js
const yourApi = restie('https://yourapi.test')

const customInterceptor = (result, options) => ({
    // you can access the current value of the result (i.e data, statusCode)
    modelIsNamedBob: result.data && result.data.name === 'bob',
    // you can access the entire options of the original request (params, headers, method, body)
    modelWasCreated: options.method === 'POST',    
});

// add the interceptor to the restie api.
// each following response will now include your custom flags
yourApi.addResponseInterceptor(customInterceptor);

// removing the interceptor is just as easy (like an event handler)
yourApi.removeRequestInterceptor(customInterceptor);
````

### Enforcing immutability

Restie provides an alternative "safe mode" for preventing unwanted mutations in critical objects, as well as ensuring data integrity once a result has come back from the remote api.

```js
// enable immutable mode
const yourApi = restie('https://yourapi.test', { immutable: true });

// does not work (in immutable mode)
yourApi.bob = true;
yourApi.configuration.cache = true;
delete yourApi.configuration;
delete yourApi.all('bob').get;
```

In Restie, this is done via a combination of `Object.freeze` for critical objects, as well as ensuring the payload accessed by `result.body().data()` becomes a newly generated JSON clone of the original result from the api.

Enabling immutability can be helpful when building either user-facing (exposed) interfaces, or when building a system with a significant amount of message passing, where data integrity is normally a concern. For most use-cases however, it is typically more beneficial to leave this mode disabled.


### Promise-splitting

Restie provides a lightweight caching mechanism, that enables caching the final response transaction from a remote api (the part where Restie prepares the final result), and pass that same Promise reference to any calls that are made to the exact same endpoint+method before the transaction has completed.

```js
// enable automatic caching mode
const yourCacheApi = restie('https://yourapi.test', { cache: true });

// you can also provide a custom caching key generator if needed
// by default, the key generator used is ${options.method}:${fullUrl}
const yourCustomCacheApi = restie('https://yourapi.test', {
    cache: true,
    // recommended to stay like this, but you can include any unusual exceptions
    // in here as well
    cacheBy: ({ options, fullUrl }) => `${options}:${fullUrl}`,
});
```

While definitely a little extra, we recommend enabling this for _most_ RESTful implementations as it will enable less overhead that relying solely on the browser's own caching mechanism - as it involves more execution time on the event loop as each request is then re-handled by the Restie async handles.


### Send method (coming soon)
