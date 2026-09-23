export function canSignIn(event, permission) {
  return Boolean(
    event.data?.email &&
    event.data.emailVerified === true &&
    !event.data.disabled &&
    event.eventType?.endsWith(":google.com") &&
    permission?.active === true
  );
}
