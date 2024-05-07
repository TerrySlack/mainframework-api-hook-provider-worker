import { useTaskQueue } from "../providers/ApiWorkerProvider";
import { useCallback, useRef, useState } from "react";
import { QueryConfig } from "../types/types";

export const useApiWorker = <T>({
  requestConfig,
  queryConfig,
  returnPromise,
}: QueryConfig): [T | undefined, () => T extends Promise<unknown> ? T : void] => {
  const { addToQueue } = useTaskQueue();
  const [data, setData] = useState<any>(undefined);
  const lastRequestRequestDate = useRef<Date>(new Date());
  const uuidRef = useRef<string>(window.crypto.randomUUID());

  const makeRequest = useCallback(
    (resolve?: (data: unknown) => void) => {
      /*     
      Resolve is passed in when a user has selected to have a promise returend, instead of a function to make a request.
      Resolve, will return the data from the api call to the calling function.
    */
      //This will stop the request from running.  Good for when a condition is met and then the query can be run or not
      if (queryConfig && typeof queryConfig?.run === "boolean" && !queryConfig?.run) {
        return;
      }

      //Compare the current time, with the last time.  If it's >= 2000 ms, then addToQueue
      const currentDate = new Date();
      if (
        !data ||
        currentDate.getTime() - lastRequestRequestDate.current.getTime() >= 2000
        //If makeRequest is called repeatedly, from re-rendering, we can avoid it by only making calls if it's been 2 seconds, since the last call.
      ) {
        //Update lastRequestRequestDate
        lastRequestRequestDate.current = new Date();

        //Add the id property
        queryConfig["id"] = `${queryConfig.cacheName}-${uuidRef.current}`;
        addToQueue(resolve ? resolve : setData, queryConfig, requestConfig);
      }
    },
    [queryConfig, requestConfig, addToQueue],
  );

  const request = returnPromise
    ? () =>
        new Promise((resolve) => {
          makeRequest(resolve); //Pass resolve to replace the use of setData, in order to have data returned from the promise
        })
    : makeRequest;

  //If there is no request object it could be a request for data from the cache.  If runAuto is used, it means the app is not using the lazy function
  if (!requestConfig || queryConfig.runAuto) {
    //Fire off request if requestObject is undefined
    request();
  }

  return [data, request as () => T extends Promise<unknown> ? T : void];
};
