import { ICourierAdapter } from './courier.interface';
import { SteadfastAdapter } from './adapters/steadfast.adapter';
import { PathaoAdapter } from './adapters/pathao.adapter';

export class CourierFactory {
  private static couriers: Map<string, ICourierAdapter> = new Map<string, ICourierAdapter>([
    ['STEADFAST', new SteadfastAdapter()],
    ['PATHAO', new PathaoAdapter()],
  ]);

  static getCourier(name: string): ICourierAdapter {
    const courier = this.couriers.get(name.toUpperCase());
    if (!courier) {
      throw new Error(`Unsupported courier provider: ${name}. Supported: STEADFAST, PATHAO`);
    }
    return courier;
  }
}
