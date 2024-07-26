import { Queue, StoreSubject, StoreSubjects, WorkerConfig } from "../../types/types";

interface NestedRecord {
  [key: string]:
    | string
    | number
    | boolean
    | File
    | Blob
    | Date
    | FileList
    | NestedRecord
    | (string | number | boolean | File | Blob | Date | FileList | NestedRecord)[];
}
//Hold the classes created on each request passed to the worker
const classQueue: Queue<ApiRequest> = {};

// Define the store
const store: StoreSubjects = {};

const isBlobOrFile = <T>(value: T): boolean => value instanceof Blob || value instanceof File;

const checkProperties = <T>(obj: T): boolean => {
  if (obj === null || typeof obj === "undefined") return false;
  if (Array.isArray(obj) || typeof obj === "object") {
    for (const key in obj as Record<string, unknown>) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = (obj as Record<string, unknown>)[key];
        if (isBlobOrFile(value)) {
          return true;
        }
        if (typeof value === "object" && value !== null && checkProperties(value)) {
          return true;
        }
      }
    }
  }

  return false;
};

// Api Request class
class ApiRequest {
  private config: WorkerConfig;

  //Note the !. This indicates taht unsubscribe will be set elsewhere, outside the construtor
  private unsubscribe!: () => void;

  constructor(config: WorkerConfig) {
    this.config = config;
    classQueue[this.config.cacheName.toString().toLocaleLowerCase()] = this;
    this.init();
  }

  private init() {
    const { cacheName, mergeExisting, data, reset, method } = this.config;
    const stringifiedCacheName = cacheName.toString().toLocaleLowerCase();
    const subject = this.initializeStoreWithCacheName(stringifiedCacheName);

    const subscribe = this.subScriberFactory(stringifiedCacheName);
    this.unsubscribe = subject.subscribe(subscribe);

    if (reset && typeof subject?.value !== "undefined") {
      this.reset(stringifiedCacheName);
    }

    if (method) {
      this.requestAndUpdateStore(this.config, this.unsubscribe);
    } else if (!method && Boolean(subject?.value)) {
      this.polling(subject);
    } else if (subject && data) {
      if (mergeExisting) {
        const mergedData = this.merge(subject.value, data, mergeExisting);
        if (mergedData) this.polling(subject, mergedData);
      } else {
        this.polling(subject, data);
      }
    }
  }

  private polling(subject: StoreSubject, data?: unknown) {
    const interval = setInterval(() => {
      if (!subject.lock) {
        subject.lock = true;
        subject.next(data ?? subject?.value);
        subject.lock = false;
        this.destroy();
        clearInterval(interval);
      }
    }, 20);
  }

  private reset(cacheName: string | number) {
    const subject = store[cacheName.toString().toLocaleLowerCase()];
    if (subject) {
      subject.value = undefined;
    }
  }

  private subScriberFactory = (cacheName: string | number) => (data: unknown) => {
    if (data) {
      postMessage({ cacheName, data });
    }
  };

  private merge = (value: unknown, data: unknown, mergeExisting: boolean): unknown => {
    if (mergeExisting && this.isObject(value) && this.isObject(data)) {
      return { ...value, ...data };
    } else if (mergeExisting && Array.isArray(value) && Array.isArray(data)) {
      return [...value, ...data];
    } else {
      return data;
    }
  };

  private initializeStoreWithCacheName(cacheName: string | number): StoreSubject {
    const stringifiedCacheName = cacheName.toString().toLocaleLowerCase();
    if (!store[stringifiedCacheName]) {
      store[stringifiedCacheName] = this.createSubject(stringifiedCacheName);
    }
    return store[stringifiedCacheName];
  }

  private createSubject(cacheName: string | number): StoreSubject {
    let subject = store[cacheName.toString().toLocaleLowerCase()];
    const stringifiedCacheName = cacheName.toString().toLocaleLowerCase();

    if (!subject) {
      subject = {
        name: stringifiedCacheName,
        lock: false,
        value: undefined,
        subscribers: [],
        next: (value: unknown) => {
          subject.value = value;
          subject.subscribers.forEach((subscriber) => subscriber(value));
        },
        subscribe: (subscriber: (data: unknown) => void) => {
          subject.subscribers.push(subscriber);
          return () => {
            subject.subscribers = subject.subscribers.filter((sub) => sub !== subscriber);
          };
        },
      };
      store[stringifiedCacheName] = subject;
    }

    return subject;
  }

  private addFileBlobToForm = (form: FormData, file: File | Blob, key: string) => {
    if (file instanceof File || file instanceof Blob) {
      //If it's a file, just use the existing name associated with it.  If it's a blob, use the key
      form.append(file instanceof File ? file.name : key, file);
    }
    return form;
  };

  private convertToFormData = (
    obj: NestedRecord,
    form: FormData = new FormData(),
    namespace: string = "",
  ): FormData => {
    for (const property in obj) {
      // eslint-disable-next-line
      if (obj.hasOwnProperty(property)) {
        const formKey = namespace ? `${namespace}[${property}]` : property;
        const value = obj[property];

        if (value instanceof FileList) {
          let i = 0;
          const len = value.length;
          while (i < len) {
            const file = value[i];
            form.append(file.name, file);
            i++;
          }
        } else if (value instanceof File || value instanceof Blob) {
          //If it's a file, just use the existing name associated with it.  If it's a blob, use the formKey
          this.addFileBlobToForm(form, value, formKey);
        } else if (value instanceof Date) {
          form.append(formKey, value.toISOString()); // Convert Date to ISO 8601 string
        } else if (value !== null && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
          //It's an object, make a recursive call
          this.convertToFormData(value as NestedRecord, form, formKey);
        } else if (Array.isArray(value)) {
          // Process the array
          let index = 0;
          while (index < value.length) {
            const element = value[index];
            const tempKey = `${formKey}[${index}]`;
            // Handle File or Blob types directly
            if (element instanceof File || element instanceof Blob) {
              this.addFileBlobToForm(form, element, tempKey);
            } else {
              // Otherwise, recursively process the element
              this.convertToFormData(element as NestedRecord, form, tempKey);
            }
            index++;
          }
        } else {
          form.append(formKey, String(value)); // Convert primitive types to string
        }
      }
    }

    return form;
  };

  private requestAndUpdateStore(config: WorkerConfig, unsubscribe: () => void) {
    const { url, method, body, headers, credentials, mode, cacheName, mergeExisting = false } = config;

    const stringifiedCacheName = cacheName.toString().toLocaleLowerCase();
    const subject = this.initializeStoreWithCacheName(stringifiedCacheName);
    if (url && method) {
      //Determine if this is a request for a fileupload or not
      const isFileUpload = checkProperties(body);

      //Dynamically add the content-type, based on whether it's a file upload or not
      const mergedHeaders = {
        ...(headers && headers),
        ...(!isFileUpload && { "Content-Type": "application/json" }),
        ...(isFileUpload && { "Content-Type": "multipart/form-data" }),
      };

      fetch(url, {
        method: method.toUpperCase(),
        headers: !isFileUpload ? mergedHeaders : undefined, //Don't add the headers if it's a file upload
        body: this.convertToFormData(body as NestedRecord),
        credentials,
        mode,
      })
        .then((response) => {
          // Check if the response is successful (status code 200-299)
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          // Parse the response as JSON
          return response.json();
        })
        .then((responseData) => {
          if (!this.isEqual(responseData, subject.value)) {
            const data = this.merge(subject.value, responseData, mergeExisting);
            if (data) this.polling(subject, data);
          } else {
            unsubscribe();
          }
        })
        .catch((error: unknown) => {
          unsubscribe();
          postMessage({
            cacheName: stringifiedCacheName,
            error: (error as Error).message,
          });
          this.destroy();
        });
    }
  }

  private isEqual(a: unknown, b: unknown): boolean {
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
        if (!this.isEqual(a[i], b[i])) {
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
      if (!keysB.includes(key) || !this.isEqual(objA[key], objB[key])) {
        return false; // Keys are different or their values are not equal
      }
      j += 1;
    }

    return true; // All keys and their values are equal
  }
  private isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

  private destroy() {
    this.unsubscribe();
    delete classQueue[this.config.cacheName.toString().toLocaleLowerCase()];
  }
}

onmessage = ({ data: { dataRequest } }: MessageEvent) => {
  //Use structured clone to trigger a new context and avoid collisions when multiple calls to the worker occur
  new ApiRequest(structuredClone(dataRequest));
};
