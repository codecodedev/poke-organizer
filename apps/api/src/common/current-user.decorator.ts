import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export type RequestUser = {
  id: string;
  email: string;
};

export const CurrentUser = createParamDecorator((data: string | undefined, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<{ user: RequestUser }>();
  const user = request.user;
  return data ? user?.[data as keyof RequestUser] : user;
});
