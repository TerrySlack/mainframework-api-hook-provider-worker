/*eslint-disable */
import { Dispatch, SetStateAction, createContext, useContext } from "react";
import { Config, QueueContextType, RequestConfig, TaskQueue, WorkerProvider } from "../../types/types";

// Create the worker once outside the hook
const apiWorker = new Worker(new URL("../../workers/api/api.worker", import.meta.url));

const addToQueue = (callback: (data: unknown) => void, config: Config, requestQueryConfig?: RequestConfig) => {
  //Check to ensure that a re-render isn't adding a duplicate task.
  const { cacheName, runOnce = false } = config;
  const task = taskQueue[cacheName];

  //Only add a new task, if it's not been in there before.  For the sake of speed, previous tasks will be kept.
  if (!task) {
    //task doesn't exist, add to the queue
    taskQueue[cacheName] = { callback };
  } else return; //If the task exists, it's because of a re-render.

  // Call the worker to process the task immediately upon adding it to the queue
  apiWorker.postMessage({
    data: { ...requestQueryConfig, cacheName, runOnce },
  });
};

// Create a context for the task queue
const TaskQueueContext = createContext<QueueContextType>({
  /* eslint-disable @typescript-eslint/no-unused-vars */
  addToQueue: (
    _: (data: Dispatch<SetStateAction<undefined>> | unknown) => void,
    _config: Config,
    _requestQueryConfig?: RequestConfig,
  ) => {
    throw new Error("addToQueue must be implemented");
  },
});
/* eslint-enable @typescript-eslint/no-unused-vars */

const taskQueue: TaskQueue = {};

// Custom provider component
export const ApiWorkerProvider = ({ children }: WorkerProvider) => {
  //Create and assign the onMessage function once.
  if (!apiWorker.onmessage) {
    apiWorker.onmessage = (event: MessageEvent) => {
      const { data, id } = event.data;

      //Get the task from the taskQuer
      const task = taskQueue[id];
      if (task) {
        //Get the callback to pass information back
        const { callback } = task;

        //Pass the data back to the callback
        callback(data, id);

        //delete the task from the queue
        delete taskQueue[id];
      }
    };
  }

  return <TaskQueueContext.Provider value={{ addToQueue }}>{children}</TaskQueueContext.Provider>;
};

// Custom hook to access TaskQueueContext
export const useTaskQueue = () => useContext(TaskQueueContext);
