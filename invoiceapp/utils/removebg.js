const API_KEY = 'ehnFLdDwSW89f2a573yxtKy1';
const ENDPOINT = 'https://api.remove.bg/v1.0/removebg';

/**
 * Removes the background from a base64-encoded image.
 *
 * @param {string} b64  Raw base64 string — NO data-URI prefix, NO whitespace.
 * @returns {string}    Raw base64 PNG with transparent background.
 *
 * KEY DECISIONS:
 *
 * 1. We send `image_file_b64` as a multipart TEXT field, NOT as a file object.
 *    Using {uri, type, name} in FormData sets a MIME label but does NOT convert
 *    the actual bytes — if the file is HEIC, remove.bg reads the magic bytes
 *    (0x00000018 66747970 for HEIC vs 0xFFD8FF for JPEG) and rejects it.
 *    Sending as a text field lets remove.bg decode the base64 itself.
 *
 * 2. We do NOT set Content-Type manually. React Native sets multipart/form-data
 *    with the correct boundary automatically; overriding it strips the boundary
 *    and breaks the request entirely.
 *
 * 3. Accept: application/json → remove.bg returns { data: { result_b64 } } so
 *    we never have to parse a binary PNG response in JS.
 */
export async function removeBackground(b64) {
  const formData = new FormData();
  formData.append('image_file_b64', b64);   // plain text field, not a file object
  formData.append('size', 'auto');

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'X-Api-Key': API_KEY,
      'Accept': 'application/json',
    },
    body: formData,
  });

  let json;
  try {
    json = await response.json();
  } catch {
    throw new Error(`remove.bg ${response.status}: non-JSON response`);
  }

  if (!response.ok) {
    throw new Error(json?.errors?.[0]?.title ?? `remove.bg error ${response.status}`);
  }

  return json.data.result_b64;
}
