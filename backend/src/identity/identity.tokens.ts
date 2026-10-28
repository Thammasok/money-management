export const IDENTITY_SERVICE = Symbol('IDENTITY_SERVICE');
export const IDENTITY_REPOSITORY = Symbol('IDENTITY_REPOSITORY');
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
/** The in-process lock that lets one sign-in per email run at a time (a KeyedMutex). */
export const SIGN_IN_LOCK = Symbol('SIGN_IN_LOCK');
