import React from 'react';
import '../styles/Orders.css';

const OrderTable = ({ orders, title, onComplete, onDelete, onPrintKitchenReceipt, onMoveToRecurring }) => {
  // Determine if Actions column should be shown
  const showActions = onComplete || onDelete || onMoveToRecurring;

  return (
    <div className="order-table">
      <h3>{title}</h3>
      <table>
        <thead>
          <tr>
            <th>Table No.</th>
            <th>Items</th>
            <th>Total</th>
            <th>Date & Time</th>
            {showActions && <th>Action</th>}
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr>
              <td colSpan={showActions ? 5 : 4}>No orders</td>
            </tr>
          ) : (
            orders.map((order) => (
              <tr key={order.id}>
                <td>{order.tableNo}</td>
                <td>{order.items.map((item) => `${item.name} (x${item.quantity})`).join(', ')}</td>
                <td>₹{order.total.toFixed(2)}</td>
                <td>{new Date(order.createdAt).toLocaleString()}</td>
                {showActions && (
                  <td>
                    {onComplete && (
                      <button
                        onClick={() => {
                          onPrintKitchenReceipt(order);
                          onComplete(order.id);
                        }}
                        style={{ marginRight: '5px' }}
                      >
                        ✔ Accept
                      </button>
                    )}
                    {onMoveToRecurring && (
                      <button
                        onClick={() => {
                          if (window.confirm('Are you sure you want to move this order to recurring?')) {
                            onMoveToRecurring(order.id);
                          }
                        }}
                        style={{ marginRight: '5px' }}
                      >
                        ↻ Move to Recurring
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this order?')) {
                            onDelete(order.id);
                          }
                        }}
                        style={{ backgroundColor: '#ff4444', color: 'white' }}
                      >
                        ✗ Delete
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default OrderTable;