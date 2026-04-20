import type { NextRequest } from 'next/server'

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Everyday APIs',
    version: '1.0.0',
    description: 'A collection of simple utility APIs.',
  },
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
        },
        required: ['error'],
      },
    },
  },
  servers: [
    { url: 'https://everday-apis.vercel.app', description: 'Production' },
  ],
  security: [{ ApiKeyAuth: [] }],
  paths: {
    '/api/weather': {
      get: {
        summary: 'Get current weather',
        description: 'Returns current weather conditions for San Francisco, CA.',
        operationId: 'getWeather',
        responses: {
          '200': {
            description: 'Weather data',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    location: { type: 'string', example: 'San Francisco, CA' },
                    temperature: { type: 'number', example: 62 },
                    unit: { type: 'string', example: 'F' },
                    condition: { type: 'string', example: 'Partly cloudy' },
                    humidity: { type: 'string', example: '72%' },
                  },
                  required: ['location', 'temperature', 'unit', 'condition', 'humidity'],
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/funfact': {
      get: {
        summary: 'Get random fun facts',
        description: 'Returns an array of randomly selected fun facts. Defaults to 1, max 10.',
        operationId: 'getFunFact',
        parameters: [
          {
            name: 'count',
            in: 'query',
            required: false,
            schema: { type: 'integer', minimum: 1, maximum: 10, default: 1 },
            description: 'Number of fun facts to return (1–10).',
          },
        ],
        responses: {
          '200': {
            description: 'An array of fun facts',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    facts: {
                      type: 'array',
                      items: { type: 'string' },
                      example: ['Honey never spoils.'],
                    },
                  },
                  required: ['facts'],
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/translate': {
      post: {
        summary: 'Translate text',
        description: 'Translates the provided text into the specified target language using Claude.',
        operationId: 'translateText',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  text: {
                    type: 'string',
                    description: 'The text to translate.',
                    example: 'Hello, world!',
                  },
                  targetLanguage: {
                    type: 'string',
                    description: 'The language to translate into.',
                    example: 'Spanish',
                  },
                },
                required: ['text', 'targetLanguage'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Translated text',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    translation: { type: 'string', example: '¡Hola, mundo!' },
                    targetLanguage: { type: 'string', example: 'Spanish' },
                  },
                  required: ['translation', 'targetLanguage'],
                },
              },
            },
          },
          '400': {
            description: 'Bad request',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
  },
}

export async function GET(_request: NextRequest) {
  return Response.json(spec)
}
