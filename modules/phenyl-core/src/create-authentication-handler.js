// @flow
import type {
  LoginCommand,
  LoginCommandResult,
  AuthenticationHandler,
  AuthenticationResult,
  ClientPool,
  Session,
  UserEntityDefinitions,
} from 'phenyl-interfaces'

/**
 *
 */
export default function createAuthenticationHandler(userEntityDefinitions: UserEntityDefinitions): AuthenticationHandler {
  return async function authenticationHandler(loginCommand: LoginCommand, session: ?Session, clients: ClientPool) :Promise<AuthenticationResult> {
    const { entityName } = loginCommand
    const definition = userEntityDefinitions[entityName]
    if (definition == null || typeof definition.authentication !== 'function') {
      throw new Error(`No authentication function found for user entity named "${entityName}".`)
    }
    return definition.authentication(loginCommand, session, clients)
  }
}