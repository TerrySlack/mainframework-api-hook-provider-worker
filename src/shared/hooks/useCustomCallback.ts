//eslint-disable-react-hooks/exhaustive-deps
import { useCallback, useRef } from "react";

import { isEqual } from "../utils/equalityChecks";

export const useCustomCallback = (callback: Function, dependencies: unknown[]) => {
  const refDependencies = useRef<unknown[]>([]);

  if (
    refDependencies.current.length === 0 ||
    !dependencies.every((dep, index) => isEqual(dep, refDependencies.current[index]))
  )
    refDependencies.current = dependencies;

  return useCallback(callback, refDependencies.current);
};
//eslint-enable-react-hooks/exhaustive-deps
