import { Dispatch, SetStateAction, ReactNode } from "react";

export interface Config {
  cacheName: string | number;
  data?: unknown;
  mergeExising?: boolean;
  run?: boolean;
  runOnce?: boolean; // Only run the query once Remove the task from the queue as I'm doing now.
  runAuto?: boolean; // Run the query, without having to use the returned function
}

export type ConfigWithId = Config & {
  id?: string;
};
export interface RequestConfig {
  url: string;
  method: "GET" | "get" | "POST" | "post" | "PATCH" | "patch" | "DELETE" | "delete";
  mode?: "cors" | "no-cors" | undefined;
  body?: unknown;
  headers?: object;
  credentials?: "include" | "same-origin" | "omit" | undefined;
}

export interface QueryConfig {
  requestConfig?: RequestConfig;
  queryConfig: ConfigWithId;
  returnPromise?: boolean;
}
export type WorkerConfig = RequestConfig &
  Omit<Config, "runAuto"> & {
    id?: string;
  };

export interface QueueContextType {
  addToQueue: (
    callback: (data: Dispatch<SetStateAction<undefined>> | unknown) => void,
    config: ConfigWithId,
    requestQueryConfig?: RequestConfig,
  ) => void;
}

export interface WorkerProvider {
  children: ReactNode;
}
// Define types for task and task queue
export interface Task {
  callback: (data: unknown, id: string) => void;
}

export interface TaskQueue {
  [id: string | number]: Task;
}

export interface StoreSubject {
  runOnce: boolean;
  value: unknown;
  subscribers: ((data: unknown) => void)[];
  next: (value: unknown) => void;
  subscribe: (subscriber: (data: unknown) => void) => () => void;
}

export interface StoreSubjects {
  [cacheName: string | number]: StoreSubject;
}
