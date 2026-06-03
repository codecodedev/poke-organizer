import { HttpError, type Session } from "./api";

export async function withAuthRetry<T>(
  session: Session,
  onSession: (session: Session) => void,
  onUnauthorized: () => Promise<Session | null>,
  action: (token: string) => Promise<T>
): Promise<T> {
  try {
    return await action(session.accessToken);
  } catch (err) {
    if (!(err instanceof HttpError) || err.status !== 401) {
      throw err;
    }

    const nextSession = await onUnauthorized();
    if (!nextSession) {
      throw err;
    }

    onSession(nextSession);
    return action(nextSession.accessToken);
  }
}
