import { useCallback, useRef } from "react";

import { isEqual } from "../utils/equalityChecks";

export const useCustomCallback = (callback: Function, dependencies: unknown[]) => {
  const refDependencies = useRef<unknown[]>([]);

  if (
    refDependencies.current.length === 0 ||
    !dependencies.every((dep, index) => isEqual(dep, refDependencies.current[index]))
  ) {
    //add the callback as a dependency to address the eslint error: react-hooks/exhaustive-deps
    dependencies.push(callback);
    refDependencies.current = dependencies;
  }
  return useCallback(callback, refDependencies.current);
};
