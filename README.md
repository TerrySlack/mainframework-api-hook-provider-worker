### A React package, that creates an api worker, provider, hook and store. Move your api calls and store off of the main thread and into a web worker

### Note: Version 1.x is deprecated. Please review these notes to upgrade

### Installation:

npm i @mainframework/api-reqpuest-provider-worker-hook
yarn @mainframework/api-reqpuest-provider-worker-hook

### Usage

### App.tsx

Wrap your application with the ApiWorkerProvider

```JS | TS
import {App} from "./App";
import { ApiWorkerProvider } from "@mainframework/api-reqpuest-provider-worker-hook";

export const App = () => (
  <ApiWorkerProvider>
    <App />
  </ApiWorkerProvider>
);
```

### making a request

Requests are made by passing in a request object.  
Here's the typing for a request object to pass to the hook
This object is optional. If it's not passed in, then any existing data within the store
will be passed back.

```JS | TS
interface RequestConfig {
  url: string;
  method: "get" | "post" | "patch" | "delete";
  mode?: "cors" | "no-cors" | undefined;
  body?: unknown;
  headers?: object;
  credentials?: "include" | "same-origin" | "omit" | undefined;
}
```

There is also a required queryConfig object.
It can be used to just fetch

```JS | TS
interface Config {
  cacheName: string | number; //This is used to store data in the store within the webworker
  runOnce?: boolean; //Only run the query once Remove the task from the queue as I'm doing now.
  runAuto?: boolean; //Run the query, without having to use the returned function
}
```

To just pull data from the cache, pass in the queryConfig with the cacheName property

```JS | TS
const [cats] = useApiWorker({
  queryConfig: {
    cacheName: "cats",
  },
});
```

In a component, where you need to make a request, use the useApiWorker hook for each request.
You can use multiple instances of the hook, and make: get, post, patch and delete reqeusts
Note: Review the interface. If you want to use cors, you need to pass credentials, which is set to undefined by default.
Also, the right side method, in the returned array from useApiWorker, it's either data, or a promise.

If you want a promise returned, you set the second parameter passed to the useApiWorker hook to true. Note: This is not the promise from
the api request, just a new promise, with the data returned from the api request.

See the post example on how to do this and use
the promise, in the bottom most useEffect

A user must enter a cacheName when using the hook. Similar to other stores, this will be used to store data in the cache, from an api request, and will also
allow the data to be retrieved elsewhere in the app, if a request object is not passed into the
worker

Note: using the returned function, lets you lazily request your data. If you want the request to
be automatically made,add the property runAuto:true and it will be fired off by the hook.
Look at the todos requests, in the examples below for configuration. Note, there is no
request for Todos in the useEffect now.

```JS | TS
{
    method: "Get",
    url: "https://jsonplaceholder.typicode.com/todos/1",
    headers: {
      "x-api-key":
        "live_YedloihKi9ObVaF7LovnmMzpe6PYkvT6NpZhRupWl0Z6VDi9WWTpHk6zqlsaqi7z",
    },
    queryConfig: {
      cacheName: "todos",
      runAuto:true //<-- By setting this to true, you don't need to use
    },
  }
```

### Examples

```JS | TS
import { useEffect } from "react";
import { useApiWorker } from "@mainframework/api-reqpuest-provider-worker-hook";

export const App = () => (
  //Store data for the post request
 const [postData, setPostData] = useState<unknown>();

  const [todos, todosRequest] = useApiWorker("todos", {
    method: "Get",
    url: "https://jsonplaceholder.typicode.com/todos/1",
    headers: {
      "x-api-key":
        "live_YedloihKi9ObVaF7LovnmMzpe6PYkvT6NpZhRupWl0Z6VDi9WWTpHk6zqlsaqi7z",
    },
    queryConfig: {
      cacheName: "todos",
      runAuto:true //<-- By setting this to true, you don't need to use
    },
  });

  const [cats, catRequest] = useApiWorker({
    requestConfig: {
      method: "get",
      url: "https://api.thecatapi.com/v1/images/search?limit=10",
    },
    queryConfig: {
      cacheName: "cats",
    },
  });


  const [posts, postsRequest] = useApiWorker("posts",
    {
      method: "Post",
      url: "https://jsonplaceholder.typicode.com/posts",
      body: {
        title: "foo",
        body: "bar",
        userId: 1,
      },
      headers: {
        "Content-type": "application/json; charset=UTF-8",
      },
    },
    queryConfig: {
      cacheName: "posts",
    },
    returnPromise: true //<--A promise is returned, instead of the data.
  );

  useEffect(() => {
    catRequest();
    //Invoking postsRequest, returns a promise, with the data in it.
    postsRequest().then((data) => {
        if (data) {
          setPostData(data);
        }
      });
  }, []);



  return (
    <div>
      {todos && (
        <div>
          <span>Todos</span>
          <div>{JSON.stringify(todos)}</div>
        </div>
      )}
      <hr />
      {cats && (
        <div>
          <span>Cats</span>
          <div>{JSON.stringify(cats)}</div>
        </div>
      )}
      <hr />
      {postData && (
        <div>
          <span>Posts</span>
          <div>{JSON.stringify(postData)}</div>
        </div>
      )}
    </div>
  );
);
```

### Some component, used somewhere else, that just requires data, without a request

```JS | TS
const SomeOtherComponent = ()=>{
    const [cats] = useApiWorker("cats"); //<--This will just retrieve the data from the store, in the worker

  return cats && (
        <div>
          <span>Cats</span>
          <div>{JSON.stringify(cats)}</div>
        </div>
      )
}
```
