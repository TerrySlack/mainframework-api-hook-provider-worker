import { useTaskQueue } from "../providers/ApiWorkerProvider";
import { useCallback, useState } from "react";

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

// Example usage:
export const useApiWorker = <T>(
  cacheName: string,
  requestObject?: RequestConfig,
  returnPromise: boolean = false,
): [T | undefined, (() => void) | (() => Promise<unknown>)] => {
  const { addToQueue } = useTaskQueue();
  const [data, setData] = useState<any>(undefined);

  const makeRequest = useCallback(
    (resolve?: (data: unknown) => void) => {
      /*
      we add this unique id, in order to keep track of data returned from the worker, and return it to the proper hook instance that called it.

      Resolve is passed in when a user has selected to have a promise returend, instead of a function to make a request.
      Resolve, will return the data from the api call to the calling function.
    */

      addToQueue(resolve ? resolve : setData, cacheName, requestObject);
    },
    [cacheName, requestObject, addToQueue],
  );

  const request = returnPromise
    ? () =>
        new Promise((resolve) => {
          makeRequest(resolve); //Pass resolve to replace the use of setData, in order to have data returned from the promise
        })
    : makeRequest;

  if (!requestObject) {
    //Fire off request if requestObject is undefined
    request();
  }

  return [data, request as (() => void) | (() => Promise<unknown>)];
};
