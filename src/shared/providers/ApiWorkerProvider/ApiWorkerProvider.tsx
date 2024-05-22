/*eslint-disable */
import { Dispatch, SetStateAction, createContext, useContext } from "react";
import { ConfigWithId, QueueContextType, RequestConfig, TaskQueue, WorkerProvider } from "../../types/types";

const taskQueue: TaskQueue = {};
// Create the worker once outside the hook
const apiWorker = new Worker(new URL("../../workers/api/api.worker", import.meta.url));

//5 minutes in milliseconds
const maxTaskLife = 5 * 60 * 1000;

// Function to check if timestamp is older than 5 minutes
const isOlderThan5Minutes = (taskTimeStamp: number, currentTime: number) => currentTime - taskTimeStamp > maxTaskLife;

// Check timestamps in the taskQueue
const checkTimestamps = () => {
  //Create a promise to check the taskQueue for memory leaks.
  new Promise(() => {
    const keys = Object.keys(taskQueue);
    let i = 0;
    const len = keys.length;

    const currentTime = new Date().getTime();

    if (len > 0)
      while (i < len) {
        //Get the key
        const key = keys[i];
        //Get the task
        const { timeStamp } = taskQueue[key];
        //Check the timestamp, if it's older than 5 mins, remove it from the taskQueue
        if (isOlderThan5Minutes(timeStamp, currentTime)) {
          delete taskQueue[key];
        }
        i++;
      }
  });
};

//This is used to determine if we need to call checkTimestamps, in onmessage
let taskQueueCheckupDate = new Date().getTime();

const addToQueue = (callback: (data: unknown) => void, config: ConfigWithId, requestQueryConfig?: RequestConfig) => {
  //Check to ensure that a re-render isn't adding a duplicate task.
  const { id = "", cacheName } = config;
  const task = taskQueue[cacheName];

  if (task || id === "") return;

  //task doesn't exist, add to the queue, with a timestamp, in milliseconds.  This will be used when the observable is iterated and time stamps are checked
  taskQueue[id] = { callback, timeStamp: new Date().getTime() };

  // Call the worker to process the task immediately upon adding it to the queue
  apiWorker.postMessage({
    dataRequest: { ...requestQueryConfig, ...config },
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
      }

      if (taskQueueCheckupDate >= maxTaskLife) {
        //Reset the time for a check
        taskQueueCheckupDate = new Date().getTime();
        //Check the queue for memory leaks
        checkTimestamps();
      }
    };
  }

  return <TaskQueueContext.Provider value={{ addToQueue }}>{children}</TaskQueueContext.Provider>;
};

// Custom hook to access TaskQueueContext
export const useTaskQueue = () => useContext(TaskQueueContext);
