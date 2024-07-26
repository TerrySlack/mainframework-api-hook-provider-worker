/*eslint-disable */
import { Dispatch, SetStateAction, createContext, useContext } from "react";
import { ConfigWithId, QueueContextType, RequestConfig, TaskQueue, WorkerProvider } from "../../types/types";

const taskQueue: TaskQueue = {};
// Create the worker once outside the hook
const apiWorker = new Worker(new URL("../../workers/api/api.worker", import.meta.url));

export const addToQueue = (
  config: ConfigWithId,
  requestQueryConfig?: RequestConfig,
  callback?: (data: Dispatch<SetStateAction<undefined>> | unknown) => void,
) => {
  //Check to ensure that a re-render isn't adding a duplicate task.
  const { cacheName } = config;
  const stringifiedCacheName = cacheName.toString().toLocaleLowerCase();

  if (callback)
    //task doesn't exist, add to the queue, with a timestamp, in milliseconds.  This will be used when the observable is iterated and time stamps are checked
    taskQueue[stringifiedCacheName] = {
      callback,
    };
  //delete the entry in the queue
  else delete taskQueue[stringifiedCacheName];

  // Call the worker to process the task immediately upon adding it to the queue
  apiWorker.postMessage({
    dataRequest: { ...requestQueryConfig, ...config },
  });
};

// Create a context for the task queue
const TaskQueueContext = createContext<QueueContextType>({
  /* eslint-disable @typescript-eslint/no-unused-vars */
  addToQueue: (
    _config: ConfigWithId,
    _requestQueryConfig?: RequestConfig,
    _?: (data: Dispatch<SetStateAction<undefined>> | unknown) => void,
    /* eslint-enable @typescript-eslint/no-unused-vars */
  ) => {
    throw new Error("addToQueue must be implemented");
  },
});

// Custom provider component
export const ApiWorkerProvider = ({ children }: WorkerProvider) => {
  //Create and assign the onMessage function once.
  if (!apiWorker.onmessage) {
    apiWorker.onmessage = (event: MessageEvent) => {
      const { data, cacheName } = event.data;
      const stringifiedCacheName = cacheName.toString().toLocaleLowerCase();

      //Get the task from the taskQueue
      const task = taskQueue[stringifiedCacheName];
      if (task) {
        //Get the callback to pass information back
        const { callback } = task;

        //Pass the data back to the callback
        callback(data);

        //delete it from the queue
        delete taskQueue[stringifiedCacheName];
      }
    };
  }

  return <TaskQueueContext.Provider value={{ addToQueue }}>{children}</TaskQueueContext.Provider>;
};

// Custom hook to access TaskQueueContext
export const useTaskQueue = () => useContext(TaskQueueContext);
