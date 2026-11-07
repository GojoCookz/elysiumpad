// The platform contract allows exactly one relative destination, never arbitrary URLs.
export function padReturnPath(search) {
  const values = new URLSearchParams(search).getAll('returnTo');
  return values.length === 1 && ['/', '/hypurrheaven/'].includes(values[0]) ? values[0] : null;
}
