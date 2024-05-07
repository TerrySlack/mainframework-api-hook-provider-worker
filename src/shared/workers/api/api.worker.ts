import { StoreSubject, StoreSubjects, WorkerConfig } from "../../types/types";

const objectType = (value: unknown) => {
  if (typeof value === "undefined") {
    return "undefined";
  } else if (typeof value === undefined) {
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

// Simulated partial store
const storeSubjects: StoreSubjects = {};

// Function to initialize store for a specific key if not already initialized1
const initializeStoreWithId = (cacheName: string | number, runOnce = false) => {
  if (!storeSubjects[cacheName]) {
    //Following the observer pattern.
    const observable = {
      runOnce,
      value: undefined,
      subscribers: [],
      next: (value: unknown) => {
        storeSubjects[cacheName].value = value;
        storeSubjects[cacheName].subscribers.forEach((subscriber) => {
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

const merge = (subject: StoreSubject, data: unknown, mergeExising = false) => {
  //If there isn't any data, then return
  if (!data) return;
  const dataType = objectType(data);
  const valueType = objectType(subject.value);
  const value = subject.value;

  if (!mergeExising || dataType === "primitive") {
    //Update the subject directly
    subject.next(data);
  } else if (dataType === "array" && valueType === "array") {
    subject.next([...(value as unknown[]), ...(data as unknown[])]);
  } else if (dataType === "object" && valueType === "object") {
    subject.next({ ...(value as object), ...(data as object) });
  } else if (dataType === "object" && valueType === "array") {
    subject.next([...(value as unknown[]), ...[data]]);
  } else {
    subject.next({ ...(value as object), ...(data as object) });
  }
};

const requestAndUpdateStore = async (
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
      //Make an api request.
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

      //set runOnce to ensure the query is only ever run once :)
      if (runOnce) {
        subject.runOnce = runOnce;
      }

      const responseData = await response.json();
      if (!isEqual(responseData, subject.value)) {
        merge(subject, responseData, mergeExising);
      }
      //Free resources
      unsubscribe();
    }
  } catch (error: unknown) {
    //Free resources
    unsubscribe();

    //Return the error
    postMessage({ id, cacheName, error: (error as Error).message });
  }
};

//In order to avoid issues with a closure, around id, we use function currying to create a unique subscriber, to pass to the subject
const subScriberFactory = (id: string | number) => (data: unknown) => {
  if (data) postMessage({ id, data });
};

// Listen for messages from the main thread
onmessage = (event: MessageEvent) => {
  const { data: config } = event.data;
  const { id, cacheName, mergeExising, runOnce, data } = config;

  //Let's return data if it already exists.  Then any new data will be posted when a request is complete.
  const subject = storeSubjects[cacheName] ?? initializeStoreWithId(cacheName, runOnce);

  //Create a subscriber function for the subject
  const subscribe = subScriberFactory(id);
  const unsubscribe = subject.subscribe(subscribe);

  if (Boolean(subject?.value) && !mergeExising) {
    //Do an early return
    postMessage({ id, data: subject.value });
  } else if (subject && data) {
    if (mergeExising) {
      merge(subject, data, mergeExising);
    } else {
      //Add the data to the subject, with an update
      subject.next(data);
    }
  }

  //Check to see if I need to unsubscribe here.
  if (subject.runOnce || !config.method) {
    unsubscribe();
  }

  if (!subject.runOnce && config?.method) {
    requestAndUpdateStore(config, unsubscribe);
  }
};
