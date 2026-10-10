import { Logger } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AccessService } from '../auth/access.service';

const FLEET_ROOM = 'fleet';

/**
 * Live Location API (component diagram: "Vehicle Tracking Service -> Live Location API
 * (WebSocket)"). A client authenticates once at connection time with `auth: { token }` and is
 * placed in the room it is allowed to see: staff see the whole fleet, ticket holders see only
 * the vehicle named in their tracking token.
 */
@WebSocketGateway({ cors: { origin: '*' } })
export class LocationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LocationGateway.name);

  constructor(private readonly accessService: AccessService) {}

  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      const access = this.accessService.authorize(token);
      client.join(access.kind === 'fleet' ? FLEET_ROOM : `vehicle:${access.vehicleReg}`);
      this.logger.debug(`Client ${client.id} joined as ${access.kind}`);
    } catch {
      client.emit('error', 'Unauthorized');
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  broadcastLocation(vehicleReg: string, payload: Record<string, unknown>) {
    this.server.to(FLEET_ROOM).to(`vehicle:${vehicleReg}`).emit('location:update', payload);
  }
}
