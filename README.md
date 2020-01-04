# Restie

Restie is a restful-js/restangular inspired REST wrapper for `fetch` implementations, but without mutative effects.


## Installing

`npm i -S @raisely/restie`


### Do No Harm License

Restie uses a non standardized software license called **Do No Harm**, which helps promote ethical use of this software, and at best, helps prevent non-ethically positioned third-parties from adopting it.

Clause 9 of [The Open Source Definition](https://opensource.org/osd) states that you are free to use this software, along with this license with any currently [appproved OSI-compatible licenses](https://opensource.org/licenses/alphabetical); making it compatible with existing open software solutions already in your project. This license only limits inclusion based on the actual project being developed.

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

| Name | Param Type | Description |
| --- | --- | --- |
| `slug` | `string \| number` | value representing a direct or nested resource under a given model. I.e `'thing-nested'` or `102`. |
| `data` | `object (plain)` | JSON representation of the payload to send up with a restful request. |
| `query` | `object (plain)` | Key-value representation of the various query parameters to bind to a given resource when sending it up the wire. By default, Restie expects the `qs` package for serializing query parameters. |
| `headers` | `object (plain)` | Key-value representation of the request header that is sent up the wire by default, this will contain `Content-Type` and `Accept` values that can be overridden as needed. |


## Advanced usage

### Using custom interceptors (coming soon)

### Enforcing immutability (coming soon)

### Send method (coming soon)

### Promise-splitting (coming soon)
