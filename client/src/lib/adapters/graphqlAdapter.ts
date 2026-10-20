/**
 * ============================================================================
 * J & D Beach House · GraphQL Frontend Adapter
 * Consumes: Data Payload 3 (Query Graph & Relational Aggregation over TCP)
 * Handles: Complex nested queries, analytics aggregation, schema operations
 * ============================================================================
 */

import { restAdapter } from './restAdapter';

export interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{ message: string; locations?: any[]; path?: string[] }>;
}

class GraphQLAdapter {
  /**
   * Execute a GraphQL query or mutation against the /graphql endpoint
   */
  public async query<T = any>(queryString: string, variables: Record<string, any> = {}): Promise<T> {
    const payload = {
      query: queryString,
      variables,
    };

    const res = await restAdapter.post<GraphQLResponse<T>>('/graphql', payload);

    if (res.errors && res.errors.length > 0) {
      const errMessage = res.errors.map((e) => e.message).join(' | ');
      const error = new Error(`GraphQL Error: ${errMessage}`);
      (error as any).errors = res.errors;
      throw error;
    }

    if (!res.data) {
      throw new Error('GraphQL response returned empty data payload');
    }

    return res.data;
  }

  public mutate<T = any>(mutationString: string, variables: Record<string, any> = {}): Promise<T> {
    return this.query<T>(mutationString, variables);
  }
}

export const graphqlAdapter = new GraphQLAdapter();
