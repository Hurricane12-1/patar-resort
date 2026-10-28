/**
 * ============================================================================
 * Rock View Beach Resort · Unified Frontend Adapter
 * Implements Architecture:
 *   - websocket  -> data payload 1 -> FRONTEND ADAPTER (websocketAdapter)
 *   - REST API   -> data payload 2 -> FRONTEND ADAPTER (restAdapter)
 *   - gRAPH QL   -> data payload 3 -> FRONTEND ADAPTER (graphqlAdapter)
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import { websocketAdapter, DataPayload1 } from './websocketAdapter';
import { restAdapter } from './restAdapter';
import { graphqlAdapter } from './graphqlAdapter';

export { websocketAdapter } from './websocketAdapter';
export { restAdapter } from './restAdapter';
export { graphqlAdapter } from './graphqlAdapter';

export const frontendAdapter = {
  ws: websocketAdapter,
  rest: restAdapter,
  graphql: graphqlAdapter,
};

/**
 * React hook to subscribe to Data Payload 1 real-time streams
 */
export function useWebSocketPayload<T = any>(topic: string, initialValue?: T) {
  const [data, setData] = useState<T | undefined>(initialValue);

  useEffect(() => {
    const unsubscribe = websocketAdapter.subscribe<T>(topic, (incoming) => {
      setData(incoming);
    });
    return unsubscribe;
  }, [topic]);

  return data;
}

export default frontendAdapter;
