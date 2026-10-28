/** Exact message texts shared by validation, the service and the guard (artifacts/F-1/02-flow.md → Error message catalogue). */
export const IdentityMessage = {
  invalidEmail: 'Enter a valid email address.',
  passwordRule:
    'Password must be at least 8 characters and include a letter, a number, and a symbol.',
  emailRequired: 'Enter your email.',
  passwordRequired: 'Enter your password.',
  emailTaken: 'This email is already registered.',
  badCredentials: 'Email or password is incorrect.',
  signInPaused: 'Too many failed sign-ins. Try again later.',
  notSignedIn: 'Not signed in.',
} as const;
