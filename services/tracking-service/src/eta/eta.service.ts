import { Injectable } from '@nestjs/common';

/**
 * ETA Prediction Engine (component diagram). Uses a straight-line haversine distance
 * from the vehicle's last known position to a target point, divided by its current
 * (or a fallback average) speed - a deliberately simple stand-in for the report's
 * fuller model, which would factor in route geometry and historical traffic.
 */
@Injectable()
export class EtaService {
  private static readonly EARTH_RADIUS_KM = 6371;
  private static readonly FALLBACK_SPEED_KMH = 30;

  haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EtaService.EARTH_RADIUS_KM * c;
  }

  etaSeconds(lat1: number, lon1: number, lat2: number, lon2: number, currentSpeedKmh?: number): number {
    const distanceKm = this.haversineKm(lat1, lon1, lat2, lon2);
    const speed = currentSpeedKmh && currentSpeedKmh > 3 ? currentSpeedKmh : EtaService.FALLBACK_SPEED_KMH;
    const hours = distanceKm / speed;
    return Math.round(hours * 3600);
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }
}
