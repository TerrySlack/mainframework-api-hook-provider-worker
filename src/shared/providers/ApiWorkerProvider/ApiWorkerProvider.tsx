/*eslint-disable */
import { Dispatch, SetStateAction, createContext, useContext } from "react";
import { Config, ConfigWithId, QueueContextType, RequestConfig, TaskQueue, WorkerProvider } from "../../types/types";

// Create the worker once outside the hook
const apiWorker = new Worker(new URL("../../workers/api/api.worker", import.meta.url));

const addToQueue = (callback: (data: unknown) => void, config: ConfigWithId, requestQueryConfig?: RequestConfig) => {
  //Check to ensure that a re-render isn't adding a duplicate task.
  const { id, cacheName } = config;
  const task = taskQueue[cacheName];

  //Duplicate, due to a re-render.  We only want to make one request.
  //Only add a new task, if it's not been in there before.  For the sake of speed, previous tasks will be kept.
  if (!task && id) {
    //task doesn't exist, add to the queue
    taskQueue[id] = { callback };
  } else return;

  // Call the worker to process the task immediately upon adding it to the queue
  apiWorker.postMessage({
    data: { ...requestQueryConfig, ...config },
  });
};

// Create a context for the task queue
const TaskQueueContext = createContext<QueueContextType>({
  /* eslint-disable @typescript-eslint/no-unused-vars */
  addToQueue: (
    _: (data: Dispatch<SetStateAction<undefined>> | unknown) => void,
    _config: ConfigWithId,
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

      //Get the task from the taskQueue
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
