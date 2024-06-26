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
will be passed back. If it is passed in, the data returned from the api will be stored and return to the calling code.

```JS | TS
interface RequestConfig {
  url: string;
  method:
    | "GET"
    | "get"
    | "POST"
    | "post"
    | "PATCH"
    | "patch"
    | "DELETE"
    | "delete";
  mode?: "cors" | "no-cors" | undefined;
  body?: unknown;
  headers?: object;
  credentials?: "include" | "same-origin" | "omit" | undefined;
}
```

There is also a required queryConfig object.
It can be used to return any existing data within the store

```JS | TS
interface Config {
  cacheName: string | number;
  data?: unknown;
  mergeExising?: boolean; //NOTE:  This will only work on arrays and objects.  Primitives will be overwritten
  run?: boolean;
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
Also, the right side property in the returend tuple it's either a function to make a call, or a promise, depending on the whether the 3rd parameter for the hook is set to true.
See below for 2 examples of using a promise. Note: This is not the promise from the api request, just a new promise, with the data returned from the api request.

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
      runAuto:true //<-- By setting this to true, you don't need to use the returned function from the tuple
    },
  }
```

### Examples

### File Uploading

The package can handle file uploading, however the format needs to be flat.

You can add any properties you like, however, when saving, only the id and file property will be used. The store in the worker, will store whatever is returned
from your api and you can do what you like with this data. Ie, perhaps an array of urls for the images are returned and can be used in a gallery.

If id is not provided, the file.name will be used.

Note: Do not pass a formData object. THe formData object will be created for you. FormData objects cannot be passed to a web worker and
the code is not built to handle getting properties form the form data object and then recreating it.

You can upload multiple files, by handling the uploading and capturing the uploading files. But ensure that the valid files
that need to be uploaded, are passed in this format.

```JS | TS
[
  {
    id: "1",  //Id is whatever you want to add
    file,  //Type File or Blob
   preview: URL.createObjectURL(file)
  },
  {
    id: "2",,  //Id is whatever you want to add
    file,  //Type File or Blob
    preview: URL.createObjectURL(file)
  },
]


 const [savedFilesStatus, saveFilesPostRequest] = useApiWorker({
    requestConfig: {
      method: "post",
      url: "Add your own url",
      body: validFiles, //This is an array as shown above
    },
    queryConfig: {
      cacheName: "pick a cache name",
    },
  });

```

```JS | TS
import { useEffect } from "react";
import { useApiWorker } from "@mainframework/api-reqpuest-provider-worker-hook";

export const App = () => (
  //Store data for the post request
 const [postData, setPostData] = useState<unknown>();

  const [todos] = useApiWorker({
    requestConfig: {
      method: "get",
      url: "https://jsonplaceholder.typicode.com/todos/100",
      headers: {
        "x-api-key":  "add your key here",
      },
    },
    queryConfig: {
      cacheName: "todos",
      runAuto: true, //<-- By setting this to true, you don't need to use
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


  const [posts, postsRequest] = useApiWorker<Promise<any>>({
    requestConfig: {
      method: "post",
      url: "https://jsonplaceholder.typicode.com/posts",
      body: {  //Body will be whatever you want it to be.
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
    true //<--this sets the property returnPromise to true, and a promise will be returned.
  });

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
  const [cats] = useApiWorker({
    queryConfig: {
      cacheName: "cats",
    },
  }); //<--This will just retrieve the data from the store, in the worker

  return cats && (
        <div>
          <span>Cats</span>
          <div>{JSON.stringify(cats)}</div>
        </div>
      )
}
```

### Here is an example of updating a component

```JS | TS
const SomeComponent = () => {
  //Fetch the posts.  Note:  Do this by calling postsRequest in a useEffect
  const [posts, postsRequest] = useApiWorker<Promise<any>>({
    requestConfig: {
      method: "post",
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
    true //<--this sets the property returnPromise to true, and a promise will be returned.
  });

  /*
    The property run will only run the query if true is passed to it. In this case, once the posts have been returned, then
    run will have a value of true.  cows (assuming it already has data in it), have posts merged into it it.
  */
  const [cows] = useApiWorker({
    queryConfig: {
      cacheName: "cows",
      run: Boolean(posts), //Only run this if posts exist.
      data: { posts }, //cats will either be populated or undefined
      mergeExising: true,
    },
  });

  useEffect(() => {
    postsRequest();
  }, []);

  return (
    cows && (
      <div>
        <span>cows</span>
        <div>{JSON.stringify(cows)}</div>
      </div>
    )
  );
};
```
