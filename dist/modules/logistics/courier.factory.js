"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CourierFactory = void 0;
const steadfast_adapter_1 = require("./adapters/steadfast.adapter");
const pathao_adapter_1 = require("./adapters/pathao.adapter");
class CourierFactory {
    static couriers = new Map([
        ['STEADFAST', new steadfast_adapter_1.SteadfastAdapter()],
        ['PATHAO', new pathao_adapter_1.PathaoAdapter()],
    ]);
    static getCourier(name) {
        const courier = this.couriers.get(name.toUpperCase());
        if (!courier) {
            throw new Error(`Unsupported courier provider: ${name}. Supported: STEADFAST, PATHAO`);
        }
        return courier;
    }
}
exports.CourierFactory = CourierFactory;
