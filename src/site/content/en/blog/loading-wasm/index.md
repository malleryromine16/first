---
layout: post
title: Loading WebAssembly modules efficiently
subhead: When working with WebAssembly, you often want to download a module, compile it, instantiate it, and then use whatever it exports in JavaScript. This post explains our recommended approach for optimal efficiency.
authors:
  - mathiasbynens
description: |
  When working with WebAssembly, you often want to download a module, compile it, instantiate it, and then use whatever it exports in JavaScript. This post explains our recommended approach for optimal efficiency.
date: 2018-04-12
updated: 2018-10-23
tags:
  - blog
  - javascript
  - webassembly

---

When working with WebAssembly, you often want to download a module, compile it, instantiate it, and
then use whatever it exports in JavaScript. This post starts off with a common but suboptimal code
snippet doing exactly that, discusses several possible optimizations, and eventually shows the
simplest, most efficient way of running WebAssembly from JavaScript.

{% Aside %}
Tools like Emscripten can produce the needed boilerplate code for you, so you don’t
necessarily have to code this yourself. In cases where you need fine-grained control over the
loading of WebAssembly modules however, it helps to keep the following best practices in mind.
{% endAside %}

This code snippet does the complete download-compile-instantiate dance, albeit in a suboptimal way:

Don’t use this!

```js
(async () => {
  const response = await fetch('fibonacci.wasm');
  const buffer = await response.arrayBuffer();
  const module = new WebAssembly.Module(buffer);
  const instance = new WebAssembly.Instance(module);
  const result = instance.exports.fibonacci(42);
  console.log(result);
})();
```

Note how we use `new WebAssembly.Module(buffer)` to turn a response buffer into a module. This is a
synchronous API, meaning it blocks the main thread until it completes. To discourage its use, Chrome
disables `WebAssembly.Module` for buffers larger than 4 KB. To work around the size limit, we can
use `await WebAssembly.compile(buffer)` instead:

```js
(async () => {
  const response = await fetch('fibonacci.wasm');
  const buffer = await response.arrayBuffer();
  const module = await WebAssembly.compile(buffer);
  const instance = new WebAssembly.Instance(module);
  const result = instance.exports.fibonacci(42);
  console.log(result);
})();
```

`await WebAssembly.compile(buffer)` is _still_ not the optimal approach, but we’ll get to that in a
second.

Almost every operation in the modified snippet is now asynchronous, as the use of `await` makes
clear. The only exception is `new WebAssembly.Instance(module)`, which has the same 4 KB buffer
size restriction in Chrome. For consistency and for the sake of [keeping the main thread
free](https://twitter.com/mathias/status/978549917332500480), we can use the asynchronous
`WebAssembly.instantiate(module)`.

```js
(async () => {
  const response = await fetch('fibonacci.wasm');
  const buffer = await response.arrayBuffer();
  const module = await WebAssembly.compile(buffer);
  const instance = await WebAssembly.instantiate(module);
  const result = instance.exports.fibonacci(42);
  console.log(result);
})();
```

Let’s get back to the `compile` optimization I hinted at earlier. With [streaming
compilation](https://v8.dev/blog/v8-release-65), the browser can already
start to compile the WebAssembly module while the module bytes are still downloading. Since download
and compilation happen in parallel, this is faster — especially for large payloads.

<figure>
{% Img src="image/T4FyVKpzu4WKF1kBNvXepbi08t52/Y1FWFpD7bgeWaN95dXdL.png", alt="When the download time is
longer than the compilation time of the WebAssembly module, then WebAssembly.compileStreaming()
finishes compilation almost immediately after the last bytes are downloaded.", width="800", height="387" %}
</figure>

To enable this optimization, use `WebAssembly.compileStreaming` instead of `WebAssembly.compile`.
This change also allows us to get rid of the intermediate array buffer, since we can now pass the
`Response` instance returned by `await fetch(url)` directly.

```js
(async () => {
  const response = await fetch('fibonacci.wasm');
  const module = await WebAssembly.compileStreaming(response);
  const instance = await WebAssembly.instantiate(module);
  const result = instance.exports.fibonacci(42);
  console.log(result);
})();
```

{% Aside %}
The server must be configured to serve the `.wasm` file with the correct MIME type by sending
the `Content-Type: application/wasm` header. In previous examples, this wasn’t necessary since we
were passing the response bytes as an array buffer, and so no MIME type checking took place.
{% endAside %}

The `WebAssembly.compileStreaming` API also accepts a promise that resolves to a `Response`
instance. If you don’t have a need for `response` elsewhere in your code, you can pass the promise
returned by `fetch` directly, without explicitly `await`ing its result:

```js
(async () => {
  const fetchPromise = fetch('fibonacci.wasm');
  const module = await WebAssembly.compileStreaming(fetchPromise);
  const instance = await WebAssembly.instantiate(module);
  const result = instance.exports.fibonacci(42);
  console.log(result);
})();
```

If you don’t need the `fetch` result elsewhere either, you could even pass it directly:

```js
(async () => {
  const module = await WebAssembly.compileStreaming(
    fetch('fibonacci.wasm'));
  const instance = await WebAssembly.instantiate(module);
  const result = instance.exports.fibonacci(42);
  console.log(result);
})();
```

I personally find it more readable to keep it on a separate line, though.

See how we compile the response into a module, and then instantiate it immediately? As it turns out,
`WebAssembly.instantiate` can compile and instantiate in one go. The
`WebAssembly.instantiateStreaming` API does this in a streaming manner:

```js
(async () => {
  const fetchPromise = fetch('fibonacci.wasm');
  const { module, instance } = await WebAssembly.instantiateStreaming(fetchPromise);
  // To create a new instance later:
  const otherInstance = await WebAssembly.instantiate(module);
  const result = instance.exports.fibonacci(42);
  console.log(result);
})();
```

If you only need a single instance, there’s no point in keeping the `module` object around,
simplifying the code further:

```js
// This is our recommended way of loading WebAssembly.
(async () => {
  const fetchPromise = fetch('fibonacci.wasm');
  const { instance } = await WebAssembly.instantiateStreaming(fetchPromise);
  const result = instance.exports.fibonacci(42);
  console.log(result);
})();
```

The optimizations we applied can be summarized as follows:

- Use asynchronous APIs to avoid blocking the main thread
- Use streaming APIs to compile and instantiate WebAssembly modules more quickly
- Don’t write code you don’t need

Have fun with WebAssembly!
