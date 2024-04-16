import { useTaskQueue } from "../providers/ApiWorkerProvider";
import { useCallback, useRef, useState } from "react";

/*
  This hook is like useState.  If you want to re-use it, you need to declare it.  It can't be created once and re-used
*/

export interface RequestConfig {
  url: string;
  method: string;
  mode?: "cors" | "no-cors";
  body?: unknown;
  headers?: object;
  credentials?: "include" | "same-origin" | "omit";
}

type DataOrPromise<T> = T | Promise<T>;
// Example usage:
export const useApiWorker = <T>(
  requestObject: RequestConfig,
  returnPromise: boolean = false,
): [DataOrPromise<T> | undefined, () => void] => {
  const { addToQueue } = useTaskQueue();
  const [data, setData] = useState<any>(undefined);
  //Generate the id once
  const uuidRef = useRef<string>(window.crypto.randomUUID());
  const makeRequest = useCallback(() => {
    /*
      Note: randomUUID is significantly faster than libraries like uuid or nanoid.  Google it.

      we add this unique id, in order to keep track of data returned from the worker, and return it to the proper hook instance that called it.
    */
    addToQueue(setData, uuidRef.current, requestObject);
  }, [requestObject, addToQueue]);

  const returnedType = returnPromise
    ? new Promise((resolve) => {
        resolve(data);
      })
    : data;

  return [returnedType, makeRequest];
};
