import { TokenPayload, RefreshTokenPayload } from './interfaces';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: TokenPayload;
      refreshTokenPayload?: RefreshTokenPayload;
    }
  }
}

export {};
