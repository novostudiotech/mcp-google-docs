import type { DriveFileResult } from '../types.js';

export async function createGoogleDoc(
  title: string,
  html: string,
  accessToken: string,
  folderId?: string
): Promise<DriveFileResult> {
  const metadata: Record<string, unknown> = {
    name: title,
    mimeType: 'application/vnd.google-apps.document',
  };
  if (folderId) {
    metadata.parents = [folderId];
  }

  const boundary = '---mcp-google-docs-boundary';
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    '',
    html,
    `--${boundary}--`,
  ].join('\r\n');

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: res.statusText } })) as { error?: { message?: string } };
    const msg = error?.error?.message ?? res.statusText;
    throw new Error(`Google Drive API error (${res.status}): ${msg}`);
  }

  const data = await res.json() as { id: string; name: string; webViewLink: string };
  return {
    docId: data.id,
    url: data.webViewLink,
    title: data.name,
  };
}
