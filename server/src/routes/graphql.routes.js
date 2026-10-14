import { Router } from 'express';
import { graphql } from 'graphql';
import { schema } from '../graphql/schema.js';
import { resolvers } from '../graphql/resolvers.js';

const router = Router();

/**
 * Native GraphQL HTTP Endpoint (Tri-API Architecture - No Apollo)
 * Executes GraphQL queries and mutations natively via the official graphql package
 */
async function handleGraphQLRequest(req, res) {
  const query = req.body?.query || req.query?.query;
  const variables = req.body?.variables || (req.query?.variables ? JSON.parse(req.query.variables) : {});
  const operationName = req.body?.operationName || req.query?.operationName;

  if (!query) {
    return res.status(400).json({
      errors: [{ message: 'Must provide query string.' }],
    });
  }

  try {
    const result = await graphql({
      schema,
      source: query,
      rootValue: resolvers,
      contextValue: {
        user: req.user,
        token: req.token,
      },
      variableValues: variables,
      operationName,
    });

    if (result.errors && result.errors.length > 0) {
      console.warn('[GraphQL Execution Warning]:', result.errors[0].message);
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({
      errors: [{ message: `GraphQL execution failed: ${err.message}` }],
    });
  }
}

router.post('/graphql', handleGraphQLRequest);
router.get('/graphql', handleGraphQLRequest);

export default router;
