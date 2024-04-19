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
): [DataOrPromise<T> | undefined, (() => void) | (() => Promise<unknown>)] => {
  const { addToQueue } = useTaskQueue();
  const [data, setData] = useState<any>(undefined);

  //Generate the id once
  const uuidRef = useRef<string>(window.crypto.randomUUID());

  const makeRequest = useCallback(
    (resolve?: (data: unknown) => void) => {
      /*
      Note: randomUUID is significantly faster than libraries like uuid or nanoid.  Google it.

      we add this unique id, in order to keep track of data returned from the worker, and return it to the proper hook instance that called it.

      resolve is passed in when a user has selected to have a promise returend, instead of a function to make a request.
      resolve, will return the data from the api call to the calling function.
    */

      addToQueue(resolve ? resolve : setData, uuidRef.current, requestObject);
    },
    [requestObject, addToQueue],
  );

  const request = returnPromise
    ? () =>
        new Promise((resolve) => {
          makeRequest(resolve); //Pass resolve to replace the use of setData, in order to have data returned from the promise
        })
    : makeRequest;

  return [data, request as (() => void) | (() => Promise<unknown>)];
};
