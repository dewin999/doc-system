import { route } from '@/lib/http';
import { destroySession } from '@/lib/auth';

export const runtime = 'nodejs';

export const POST = route(async () => {
  await destroySession();
  return { success: true };
});
