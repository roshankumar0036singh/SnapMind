/**
 * `/browser` predates the Research screen, which now owns every `research`
 * router route including this one. The landing page and the extension both link
 * here, so the URL keeps working — it just lands on the real thing.
 *
 * This is the last file that referenced `useChat` / `GeneratorInput` /
 * `RenderMessage` and the `/api/browser` proxy; nothing else does.
 */

import { redirect } from 'next/navigation';

export default function BrowserPage() {
  redirect('/research?mode=browser');
}
