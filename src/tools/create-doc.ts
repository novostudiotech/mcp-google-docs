import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { markdownToHtml } from '../lib/markdown.js';
import { createGoogleDoc } from '../lib/drive.js';

export function registerTools(server: McpServer, googleAccessToken: string): void {
  server.tool(
    'create_google_doc',
    'Convert markdown text into a Google Doc in the user\'s Google Drive',
    {
      title: z.string().describe('Title of the Google Doc'),
      markdown: z.string().describe('Markdown content to convert'),
      folderId: z.string().optional().describe('Google Drive folder ID (optional)'),
    },
    async ({ title, markdown, folderId }) => {
      const html = markdownToHtml(markdown);
      const result = await createGoogleDoc(title, html, googleAccessToken, folderId);

      return {
        content: [
          {
            type: 'text' as const,
            text: `Created Google Doc "${result.title}"\nURL: ${result.url}\nDoc ID: ${result.docId}`,
          },
        ],
      };
    }
  );
}
