# A React package, that creates an api worker, provider and hook. Move your api's off of the main thread.

## Installation:

npm i @mainframework/api-reqpuest-provider-worker-hook
yarn @mainframework/api-reqpuest-provider-worker-hook

## urls

[npm-url]: https://www.npmjs.com/package/@mainframework/api-reqpuest-provider-worker-hook

## Usage :

## App.tsx

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

## making a request

## Request Type

Here's the typing for a request object to pass to the hook

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

In a component, where you need to make a request, use the useApiWorker hook for each request.
You can use multiple instances of the hook, and make: get, post, patch and delete reqeusts
Note: Review the interface. If you want to use cors, you need to had credentials, and the mode. They are set to undefined by default.
Also, the left side of the returne array from useApiWorker, it's either data, or a promise. See below for an example of how to use both.
If you want a promise returned, you set the second paramter passed to the useApiWorker hook to true. Note: This is not the promise from
the api request, just a new promise, with the data returned from the api request.  
See the post example on how to do this and use
the promise, in the bottom most useEffect

```JS | TS
import { useEffect } from "react";
import { useApiWorker } from "@mainframework/api-reqpuest-provider-worker-hook";

export const App = () => (
  //Store data for the post request
 const [postData, setPostData] = useState<unknown>();
  const [todos, todosRequest] = useApiWorker({
    method: "Get",
    url: "https://jsonplaceholder.typicode.com/todos/1",
    headers: {
      "x-api-key":
        "live_YedloihKi9ObVaF7LovnmMzpe6PYkvT6NpZhRupWl0Z6VDi9WWTpHk6zqlsaqi7z",
    },
  });

  const [cats, catRequest] = useApiWorker({
    method: "Get",
    url: "https://api.thecatapi.com/v1/images/search?limit=10",
  });

  const [posts, postsRequest] = useApiWorker(
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
    true //<--By Adding true, a promise is returned, instead of the data.
  );

  useEffect(() => {
    catRequest();
    todosRequest();
    postsRequest();
  }, []);

  useEffect(() => {
    if (typeof posts !== "undefined") {
      if (posts instanceof Promise) {
        posts.then((data) => {
          if (data) setPostData(data);
        });
      } else setPostData(posts);
    }
  }, [posts]);
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
