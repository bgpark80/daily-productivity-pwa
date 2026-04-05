import { useEffect, useState } from 'react';

const cloneInitialValue = (initialValue) => {
  if (Array.isArray(initialValue)) {
    return [...initialValue];
  }

  if (initialValue && typeof initialValue === 'object') {
    return { ...initialValue };
  }

  return initialValue;
};

function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      const parsedValue = item ? JSON.parse(item) : cloneInitialValue(initialValue);

      if (Array.isArray(initialValue) && !Array.isArray(parsedValue)) {
        return cloneInitialValue(initialValue);
      }

      if (
        initialValue &&
        typeof initialValue === 'object' &&
        !Array.isArray(initialValue) &&
        (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue))
      ) {
        return cloneInitialValue(initialValue);
      }

      return parsedValue;
    } catch (error) {
      console.error('Could not read local storage:', error);
      return cloneInitialValue(initialValue);
    }
  });

  useEffect(() => {
    try {
      // Save the latest value every time it changes.
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.error('Could not write local storage:', error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}

export default useLocalStorage;
