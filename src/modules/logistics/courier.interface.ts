export interface CreateParcelRequest {
  tenantId: string;
  orderId: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  codAmount: number; // Cash On Delivery amount
  itemDescription?: string;
  weightKg?: number;
}

export interface CreateParcelResponse {
  success: boolean;
  courier: 'STEADFAST' | 'PATHAO';
  consignmentId: string;
  trackingCode?: string;
  status: string;
  deliveryFee?: number;
  labelUrl?: string;
}

export interface ParcelTrackingInfo {
  consignmentId: string;
  trackingCode: string;
  status: string;
  courier: string;
  updatedAt: Date;
}

export interface ICourierAdapter {
  readonly courierName: 'STEADFAST' | 'PATHAO';
  createParcel(req: CreateParcelRequest): Promise<CreateParcelResponse>;
  trackParcel(consignmentId: string): Promise<ParcelTrackingInfo>;
}
