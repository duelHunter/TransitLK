import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

/**
 * Live Location API (component diagram: "Vehicle Tracking Service -> Live Location API
 * (WebSocket)"). Clients connect once and either receive every update, or call
 * `subscribeVehicle`/`subscribeRoute` to scope updates to a room, keeping fan-out cheap.
 */
@WebSocketGateway({ cors: { origin: '*' } })
export class LocationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LocationGateway.name);

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribeVehicle')
  onSubscribeVehicle(client: Socket, vehicleReg: string) {
    client.join(`vehicle:${vehicleReg}`);
  }

  broadcastLocation(vehicleReg: string, payload: Record<string, unknown>) {
    this.server.emit('location:update', payload);
    this.server.to(`vehicle:${vehicleReg}`).emit(`location:${vehicleReg}`, payload);
  }
}
