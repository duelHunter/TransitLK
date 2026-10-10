import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

export type Access = { kind: 'fleet' } | { kind: 'vehicle'; vehicleReg: string };

const STAFF_ROLES = ['OPERATOR', 'ADMIN'];

export function bearerToken(header?: string): string | undefined {
  const match = /^Bearer\s+(.+)$/i.exec(header ?? '');
  return match ? match[1] : undefined;
}

/**
 * Decides what a caller may watch. Passengers carry a vehicle-scoped token issued by the
 * ticketing service; staff carry a normal user-service JWT. Verification is local, so
 * tracking never calls another service.
 */
@Injectable()
export class AccessService {
  private readonly userSecret =
    process.env.JWT_SECRET ?? 'transitlk-dev-secret-key-change-me-please-32bytes+';
  private readonly trackSecret =
    process.env.TRACKING_TOKEN_SECRET ?? 'transitlk-tracking-token-secret-32bytes-min';

  authorize(token: string | undefined): Access {
    if (!token) {
      throw new UnauthorizedException('Missing token');
    }

    const track = this.verify(token, this.trackSecret);
    if (track && track.purpose === 'track' && typeof track.vehicleReg === 'string') {
      return { kind: 'vehicle', vehicleReg: track.vehicleReg };
    }

    const user = this.verify(token, this.userSecret);
    if (user && typeof user.role === 'string' && STAFF_ROLES.includes(user.role)) {
      return { kind: 'fleet' };
    }

    throw new UnauthorizedException('Invalid or insufficient token');
  }

  canView(access: Access, vehicleReg: string): boolean {
    return access.kind === 'fleet' || access.vehicleReg === vehicleReg;
  }

  private verify(token: string, secret: string): jwt.JwtPayload | undefined {
    try {
      const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
      return typeof payload === 'string' ? undefined : payload;
    } catch {
      return undefined;
    }
  }
}
