import { Dispatch, SetStateAction, ReactNode } from "react";

export interface Config {
  cacheName: string | number;
  data?: unknown;
  mergeExisting?: boolean;
  run?: boolean;
  runOnce?: boolean; //Only run the query once Remove the task from the queue as I'm doing now.
  runAuto?: boolean; //Run the query, without having to use the returned function
  reset?: Reset;
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
  Omit<ConfigWithId, "runAuto"> & {
    id?: string;
  };

export interface QueueContextType {
  addToQueue: (
    config: ConfigWithId,
    requestQueryConfig?: RequestConfig,
    callback?: (data: Dispatch<SetStateAction<undefined>> | unknown) => void,
  ) => void;
}

export interface WorkerProvider {
  children: ReactNode;
}
// Define types for task and task queue
export interface Task {
  callback: (data: unknown) => void;
}

export interface TaskQueue {
  [id: string | number]: Task;
}

export interface StoreSubject {
  name: string | number;
  lock: boolean;
  value: unknown;
  subscribers: ((data: unknown) => void)[];
  next: (value: unknown) => void;
  subscribe: (subscriber: (data: unknown) => void) => () => void;
}

export interface StoreSubjects {
  [cacheName: string | number]: StoreSubject;
}

export interface ResetConfig {
  cacheName: string;
  placeHolderData: unknown;
}

export type Queue<T> = Record<string, T>;

export type Reset = string | ResetConfig;
