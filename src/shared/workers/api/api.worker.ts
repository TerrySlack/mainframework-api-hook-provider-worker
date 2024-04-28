import { StoreSubjects, WorkerConfig } from "../../types/types";

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
const initializeStoreWithId = (id: string | number) => {
  if (!storeSubjects[id]) {
    //Following the observer pattern.
    const observable = {
      runOnce: false,
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

const requestAndUpdateStore = async ({
  url,
  method,
  body,
  headers,
  credentials = undefined,
  mode = undefined,
  cacheName,
  runOnce = false,
}: WorkerConfig) => {
  //Add an entry to the store if it's not present
  initializeStoreWithId(cacheName);

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
    const subject = storeSubjects[cacheName];

    //set runOnce to ensure the query is only ever run once :)
    if (runOnce) {
      subject.runOnce = runOnce;
    }

    // Compare new data with current data.  If it's different, then update the subject, which will trigger a post back to the main thread
    if (!isEqual(responseData, subject.value)) {
      //Add the data
      subject.next(responseData);
    }
  } catch (error: unknown) {
    postMessage({ cacheName, error: (error as Error).message });
  }
};

// Listen for messages from the main thread
onmessage = (event: MessageEvent) => {
  const { data } = event.data;
  const id = data.cacheName;

  //Let's return data if it already exists.  Then any new data will be posted when a request is complete.
  const subject = storeSubjects[id];

  //For some reason TS wants me to coerce subject to a storesubject.  Despite knowing that StoreSubjects is a StoreSubject array
  if (subject) {
    postMessage({ id, data: subject.value });
  }

  //Fetch new data, if a data object was passed in
  if (!subject || (subject && !subject.runOnce && data?.method)) {
    requestAndUpdateStore(data);
  }
};
