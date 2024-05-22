import { StoreSubject, StoreSubjects, WorkerConfig, Queue, Reset, ResetConfig } from "../../types/types";

const objectType = (value: unknown) => {
  if (typeof value === "undefined") {
    return "undefined";
  } else if (value === null) {
    return "null";
  } else if (Array.isArray(value)) return "array";
  else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return "object";
  } else return "primitive";
};

const isEqual = (a: unknown, b: unknown): boolean => {
  if (typeof a !== typeof b) {
    return false; // Types are different
  }

  if (typeof a !== "object" || a === null) {
    return a === b; // For non-object types, perform simple comparison
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false; // Arrays have different lengths
    }
    let i = 0;
    while (i < a.length) {
      if (!isEqual(a[i], b[i])) {
        return false; // Array elements are different
      }
      i += 1;
    }

    return true; // All array elements are equal
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    return false; // One is an array and the other is not, they can't be equal
  }

  const objA = a as Record<string | number, unknown>;
  const objB = b as Record<string | number, unknown>;

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) {
    return false; // Objects have different number of keys
  }

  let j = 0;
  while (j < keysA.length) {
    const key = keysA[j];
    if (!keysB.includes(key) || !isEqual(objA[key], objB[key])) {
      return false; // Keys are different or their values are not equal
    }
    j += 1;
  }

  return true; // All keys and their values are equal
};
const merge = (value: unknown, data: unknown, mergeExising = false) => {
  if (!data) return value;
  if (!value) return data;

  const dataType = objectType(data);
  const valueType = objectType(value);

  if (!mergeExising || dataType === "primitive") {
    //Update the subject directly
    return data;
  } else if (dataType === "array" && valueType === "array") {
    return [...(value as unknown[]), ...(data as unknown[])];
  } else if (dataType === "object" && valueType === "object") {
    //Check, if both objects have the same keys, then return an array, otherwise, return an object.
    if (isEqual(Object.keys(value), Object.keys(data))) {
      return [value, data];
    }
    return { ...(value as object), ...(data as object) };
  } else if (dataType === "object" && valueType === "array") {
    return [...(value as unknown[]), ...[data]];
  } else {
    return { ...(value as object), ...(data as object) };
  }
};

const mergeNext = (value: unknown, data: unknown, mergeExising = false) => {
  //If there isn't any data, then return
  if (!data) return undefined;

  if (!mergeExising || objectType(data) === "primitive") {
    //Update the subject directly
    //subject.next(data);
    return data;
  }
  //return the merged data
  return merge(value, data, mergeExising);
};

const requestAndUpdateStore = async (
  instance: ApiRequest,
  {
    url,
    method,
    body,
    headers,
    credentials = undefined,
    mode = undefined,
    cacheName,
    runOnce = false,
    mergeExising = false,
    id,
  }: WorkerConfig,
  unsubscribe: () => void,
) => {
  //Add an entry to the store if it's not present
  const subject = initializeStoreWithId(cacheName, runOnce);

  try {
    if (url && method) {
      //Still want to make an api request.
      const response = await fetch(url, {
        method: method.toLocaleUpperCase(),
        headers: { "Content-Type": "application/json", ...headers },
        body: body ? JSON.stringify(body) : undefined,
        credentials,
        mode,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const responseData = await response.json();

      // //set runOnce to ensure the query is only ever run once :)
      if (runOnce) {
        subject.runOnce = runOnce;
      }

      if (!isEqual(responseData, subject.value)) {
        const data = mergeNext(subject.value, responseData, mergeExising);
        if (data) instance.polling(subject, data);
      }
      //Free resources
      else unsubscribe();
    }
  } catch (error: unknown) {
    //Free resources
    unsubscribe();

    //Return the error
    postMessage({
      id,
      cacheName,
      error: (error as Error).message,
      //pending: false,
    });
    instance.destroy();
  }
};

const subScriberFactory = (id: string | number) => (data: unknown) => {
  if (data) postMessage({ id, data });
};
const classQueue: Queue<ApiRequest> = {};
const storeSubjects: StoreSubjects = {};

const initializeStoreWithId = (cacheName: string | number, runOnce = false) => {
  if (!storeSubjects[cacheName]) {
    //Following the observer pattern.
    const observable: StoreSubject = {
      name: cacheName,
      lock: false,
      runOnce,
      value: undefined,
      subscribers: [],
      next: (value: unknown) => {
        //Check if the currentvalue is the same as the incoming value.
        if (isEqual(value, observable.value)) return;
        observable.value = value;
        observable.subscribers.forEach((subscriber) => {
          subscriber(value);
        });
      },
      subscribe: (subscriber: (data: unknown) => void) => {
        const subject = storeSubjects[cacheName];
        if (subject) {
          subject.subscribers.push(subscriber);
        }

        // Return unsubscribe function
        return () => {
          subject.subscribers = subject.subscribers.filter((s) => s !== subscriber);
        };
      },
    };
    //Add to the store
    storeSubjects[cacheName] = observable;
  }
  //Return the subject
  return storeSubjects[cacheName];
};

//Reset the cache to the initial state or upldate with placeholder data
const resetCache = (reset: Reset) => {
  //Determine if reset is a string or an object
  const isObj = objectType(reset) === "object";

  //Get the cacheName, based on the value of isObj
  const cacheName = isObj ? (reset as ResetConfig).cacheName : (reset as string);

  //Extract the place holder if it exists
  const placeHolderData = isObj ? (reset as ResetConfig).placeHolderData : undefined;

  //Ensure that some data was passed in.
  const data = placeHolderData ?? undefined;

  //Get the subject
  const subject = storeSubjects[cacheName] as StoreSubject;

  //reset the subject.value property
  subject.next(data);
};

/*
    When this class is instantiated, it will add itself to the global classQueue.  All code will be executed inside the class.
    There won't be any object oriented coding happening, in order to avoid collisions from multiple calls to the web worker.
*/
class ApiRequest {
  private config: WorkerConfig;
  private unsubscribe: any;
  constructor(config: WorkerConfig) {
    // Initialize the class with the provided config
    this.config = config;
    const id = this.config.id;
    if (id) {
      // Add the instance to the class queue
      classQueue[id] = this;
      //Start the request
      this.init();
    }
  }

  polling(subject: StoreSubject, data: unknown, callDestroy = false) {
    //We want to poll the observable, and if it's lock property is false, update the value.
    const interval = setInterval(() => {
      if (!subject.lock) {
        //lock the the observable, to prevent collisions
        subject.lock = true;

        //update the subject with the data
        subject.next(data);
        //free the subject
        subject.lock = false;

        if (callDestroy)
          //Remove this instance from the queue
          this.destroy();

        //Free resources
        clearInterval(interval);
      }
    }, 20);
  }
  init() {
    const {
      id = "",
      cacheName,
      //pending = false,
      mergeExising,
      runOnce,
      data,
      reset,
    } = this.config;

    if (id.length === 0) return;
    //Let's return data if it already exists.  Then any new data will be posted when a request is complete.
    const subject = storeSubjects[cacheName] ?? initializeStoreWithId(cacheName, runOnce);

    //const subscribe = subScriberFactory(id, pending ? false : pending);
    const subscribe = subScriberFactory(id);
    this.unsubscribe = subject.subscribe(subscribe);

    if (reset) {
      this.reset(reset);
    }

    if (subject?.value) {
      postMessage({
        id,
        data: subject.value,
      });
    } else if (subject && data) {
      if (mergeExising) {
        const mergedData = mergeNext(subject.value, data, mergeExising);
        if (mergedData) this.polling(subject, mergedData);
      } else {
        //Add the data to the subject, with an update
        this.polling(subject, data);
      }
    }

    if (Boolean(!subject.runOnce) && Boolean(this.config?.method)) {
      requestAndUpdateStore(this, this.config, this.unsubscribe);
    } else if (subject.runOnce) {
      //Free resources.  Remove the class instance from the classQueue
      this.destroy();
    }
  }

  reset(reset: Reset) {
    resetCache(reset);
  }

  destroy() {
    //Clean up the subscriber
    this.unsubscribe();

    const id = this.config.id?.toString() ?? "";
    if (id.length === 0) return;
    // Clean up resources and remove the instance from the queue
    delete classQueue[id];
  }
}

const addClass = (dataRequest: WorkerConfig) => {
  //Create a new class, by passing a copy of dataRequest.  The class will add itself to a queue, so no need
  new ApiRequest(structuredClone(dataRequest));
};

onmessage = ({ data: { dataRequest } }: MessageEvent) => {
  //Use addClass to setup a new JS context and help prevent collisions, from multiple calls to the web worker.
  addClass(dataRequest);
};
