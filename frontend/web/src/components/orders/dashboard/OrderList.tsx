import React from 'react';
import { Order } from '../../../types/orders';
import OrderCard from './OrderCard';

interface Props {
  orders: Order[];
  onOrderUpdated: () => void;
}

export const OrderList: React.FC<Props> = ({ orders, onOrderUpdated }) => {
  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <OrderCard
          key={order.order_id}
          order={order}
          onUpdated={onOrderUpdated}
        />
      ))}
    </div>
  );
};

export default OrderList;
