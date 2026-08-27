/**
 * Legacy path shape. Sessions live at `/text-generator?id=<session_id>` so that
 * there is one transcript implementation and one place session state is owned;
 * this route only forwards.
 */

import { redirect } from 'next/navigation';

export default async function Page({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params;
  redirect(`/text-generator?id=${encodeURIComponent(chatId)}`);
}
