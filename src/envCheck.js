'use strict';

/**
 * Validates process.env at boot and throws immediately if something is
 * configured in a way that would be unsafe or nonsensical to run with.
 * Failing fast here is deliberate: a stadium ops tool that silently starts
 * in a misconfigured state is worse than one that refuses to start.
 */
function validateEnv(env = process.env) {
  const errors = [];

  if (env.PORT !== undefined) {
    const port = Number(env.PORT);
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      errors.push(`PORT must be an integer between 1 and 65535, got "${env.PORT}"`);
    }
  }

  if (env.ORION_API_KEY !== undefined && env.ORION_API_KEY.length > 0) {
    if (env.ORION_API_KEY.length < 16) {
      errors.push(
        'ORION_API_KEY is set but shorter than 16 characters — too weak to gate write access with.'
      );
    }
  }

  if (env.ANTHROPIC_API_KEY !== undefined && env.ANTHROPIC_API_KEY.length > 0) {
    if (!env.ANTHROPIC_API_KEY.startsWith('sk-ant-')) {
      errors.push(
        'ANTHROPIC_API_KEY is set but does not look like a valid Anthropic key ' +
          '(expected it to start with "sk-ant-"). Refusing to start with a key ' +
          'that would just fail on first use.'
      );
    }
  }

  if (env.NODE_ENV !== undefined) {
    const known = ['development', 'production', 'test'];
    if (!known.includes(env.NODE_ENV)) {
      errors.push(`NODE_ENV "${env.NODE_ENV}" is not one of: ${known.join(', ')}`);
    }
  }

  if (errors.length > 0) {
    const message = ['Refusing to start due to invalid environment configuration:']
      .concat(errors.map((e) => `  - ${e}`))
      .join('\n');
    throw new Error(message);
  }
}

module.exports = { validateEnv };
