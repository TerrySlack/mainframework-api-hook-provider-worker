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

interface StoreSubject {
  value: unknown;
  subscribers: ((data: unknown) => void)[];
  next: (data: unknown) => void;
  subscribe: (subscriber: (data: unknown) => void) => () => void;
}

interface StoreSubjects {
  [id: string | number]: StoreSubject;
}

// Simulated partial store
const storeSubjects: StoreSubjects = {};

// Function to initialize store for a specific key if not already initialized1
const initializeStoreWithId = (id: string) => {
  if (!storeSubjects[id]) {
    //Following the observer pattern.
    const observable = {
      value: {},
      subscribers: [],
      next: (data: unknown) => {
        storeSubjects[id].value = data;
        storeSubjects[id].subscribers.forEach((subscriber) => {
          subscriber(data);
        });
      },
      subscribe: (subscriber: (data: unknown) => void) => {
        const subject = storeSubjects[id];
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
    storeSubjects[id] = observable;

    //Subscribe right away to listen for changes
    observable.subscribe((data: unknown) => {
      if (data) postMessage({ id, data });
    });
  }
};

interface RequestConfig {
  url: string;
  method: "get" | "post" | "patch" | "delete";
  mode?: "cors" | "no-cors" | undefined;
  body?: unknown;
  headers?: object;
  credentials?: "include" | "same-origin" | "omit" | undefined;
}

// Common function to handle fetch requests and update store
const requestAndUpdateStore = async (
  id: string,
  { url, method, body, headers, credentials = undefined, mode = undefined }: RequestConfig,
) => {
  initializeStoreWithId(id);

  try {
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

    //Get the subject
    const { value, next } = storeSubjects[id];
    //const currentData = subject.value;

    // Compare new data with current data
    if (!isEqual(responseData, value)) {
      //Add the data
      next(responseData);
    }
  } catch (error: unknown) {
    postMessage({ id, error: (error as Error).message });
  }
};

// Listen for messages from the main thread
onmessage = (event: MessageEvent) => {
  const {
    data,
    //data: { url, method, body, headers, credentials, mode },
    id,
  } = event.data;

  //Let's return data if it already exists.  Then any new data will be posted when a request is complete.
  const subject = storeSubjects[id];
  if (subject) {
    const { value } = subject;
    postMessage({ id, data: value });
  }
  //Fetch new data, if a data object was passed in
  if (data) {
    requestAndUpdateStore(id, data);
  }
};
