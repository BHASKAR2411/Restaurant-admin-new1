import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import Sidebar from '../components/Sidebar';
import OrderTable from '../components/OrderTable';
import LoadingSpinner from '../components/LoadingSpinner';
import { toast } from 'react-toastify';
import '../styles/Orders.css';

const Orders = () => {
  const [liveOrders, setLiveOrders] = useState([]);
  const [recurringOrders, setRecurringOrders] = useState([]);
  const [pastOrders, setPastOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState('');
  const [gst, setGst] = useState('');
  const [discount, setDiscount] = useState('');
  const [message, setMessage] = useState('Have a nice day!');
  const [restaurantDetails, setRestaurantDetails] = useState({
    name: 'Unnamed Restaurant',
    fssai: 'N/A',
    gst: 'N/A',
    phoneNumber: 'N/A',
    address: 'N/A',
  });
  const [pastOrderDateFilter, setPastOrderDateFilter] = useState('');
  const [visiblePastOrders, setVisiblePastOrders] = useState(50);

  useEffect(() => {
    const fetchOrdersAndRestaurantDetails = async () => {
      try {
        const [liveRes, recurringRes, pastRes, restaurantRes] = await Promise.all([
          axios.get(`${process.env.REACT_APP_API_URL}/orders/live`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          }),
          axios.get(`${process.env.REACT_APP_API_URL}/orders/recurring`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          }),
          axios.get(`${process.env.REACT_APP_API_URL}/orders/past`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          }),
          axios.get(`${process.env.REACT_APP_API_URL}/orders/restaurant/details`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          }).catch(() => ({ data: {} })),
        ]);
        setLiveOrders(liveRes.data);
        setRecurringOrders(recurringRes.data);
        setPastOrders(pastRes.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        setRestaurantDetails({
          name: restaurantRes.data.name || 'Unnamed Restaurant',
          fssai: restaurantRes.data.fssai || 'N/A',
          gst: restaurantRes.data.gst || 'N/A',
          phoneNumber: restaurantRes.data.phoneNumber || 'N/A',
          address: restaurantRes.data.address || 'N/A',
        });
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to fetch orders or restaurant details');
        setLoading(false);
      }
    };
    fetchOrdersAndRestaurantDetails();

    const socket = io(process.env.REACT_APP_API_URL.replace('/api', ''), {
      auth: { token: localStorage.getItem('token') },
    });

    socket.on('connect', () => {
      console.log('WebSocket connected:', socket.id);
    });
    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error.message);
    });
    socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
    });

    const token = localStorage.getItem('token');
    let userId;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      userId = payload.id;
      console.log('Parsed userId from token:', userId);
    } catch (error) {
      console.error('Error parsing token:', error);
      socket.disconnect();
      return;
    }

    socket.on('newOrder', (order) => {
      console.log('Received newOrder:', order, 'for userId:', order.userId);
      if (order.userId === userId) {
        setLiveOrders((prevOrders) => {
          if (prevOrders.some((o) => o.id === order.id)) {
            console.log('Order already exists, skipping:', order.id);
            return prevOrders;
          }
          console.log('Adding new order to liveOrders:', order.id);
          const newOrders = [...prevOrders, order];
          console.log('Updated liveOrders:', newOrders);
          return newOrders;
        });
        toast.info(`New order #${order.id} received for Table ${order.tableNo}`);
      } else {
        console.log('Order ignored, userId mismatch:', order.userId, 'vs', userId);
      }
    });

    const pollOrders = async () => {
      try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/orders/live`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        setLiveOrders((prevOrders) => {
          const newOrders = res.data.filter((order) => !prevOrders.some((o) => o.id === order.id));
          if (newOrders.length > 0) {
            console.log('Polling added new orders:', newOrders);
            newOrders.forEach((order) => {
              toast.info(`New order #${order.id} received for Table ${order.tableNo} (via polling)`);
            });
          }
          return [...prevOrders, ...newOrders];
        });
      } catch (error) {
        console.error('Polling error:', error);
      }
    };
    const pollInterval = setInterval(pollOrders, 10000);

    return () => {
      console.log('Cleaning up WebSocket connection and polling');
      socket.disconnect();
      clearInterval(pollInterval);
    };
  }, []);

  const handleComplete = async (id) => {
    setLoading(true);
    try {
      const res = await axios.put(
        `${process.env.REACT_APP_API_URL}/orders/${id}/recurring`,
        {},
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setLiveOrders(liveOrders.filter((order) => order.id !== id));
      setRecurringOrders([...recurringOrders, res.data]);
      toast.success('Order moved to recurring');
    } catch (error) {
      toast.error('Failed to process order');
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    setLoading(true);
    try {
      await axios.delete(
        `${process.env.REACT_APP_API_URL}/orders/${id}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setLiveOrders(liveOrders.filter((order) => order.id !== id));
      setRecurringOrders(recurringOrders.filter((order) => order.id !== id));
      setPastOrders(pastOrders.filter((order) => order.id !== id));
      toast.success('Order deleted successfully');
    } catch (error) {
      toast.error('Failed to delete order');
    }
    setLoading(false);
  };

  const handleMoveToRecurring = async (id) => {
    setLoading(true);
    try {
      const res = await axios.put(
        `${process.env.REACT_APP_API_URL}/orders/${id}/recurring`,
        {},
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setPastOrders(pastOrders.filter((order) => order.id !== id));
      setRecurringOrders([...recurringOrders, res.data]);
      toast.success('Order moved back to recurring');
    } catch (error) {
      toast.error('Failed to move order to recurring');
    }
    setLoading(false);
  };

  const handlePrintKitchenReceipt = (order) => {
    const receiptContent = `
      <html>
        <head>
          <style>
            body {
              font-family: 'Courier New', monospace;
              font-size: 10px;
              width: 80mm;
              margin: 0;
              padding: 5mm;
              line-height: 1.4;
            }
            .receipt-container {
              border: 1px solid #000;
              padding: 5px;
            }
            .header {
              text-align: center;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .details {
              margin-bottom: 5px;
            }
            .details p {
              margin: 2px 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 5px;
            }
            th, td {
              border: 1px solid #000;
              padding: 3px;
              text-align: left;
            }
            th {
              background-color: #eee;
            }
            .qty { width: 15%; }
            .item { width: 55%; }
            .price { width: 30%; text-align: right; }
            .total { text-align: right; font-weight: bold; }
            .instructions {
              margin-top: 5px;
              font g-style: italic;
            }
            .divider {
              border-top: 1px dashed #000;
              margin: 5px 0;
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <div class="header">KITCHEN RECEIPT</div>
            <div class="divider"></div>
            <div class="details">
              <p>Order ID: ${order.id}</p>
              <p>Table No: ${order.tableNo}</p>
              <p>Date: ${new Date(order.createdAt).toLocaleString()}</p>
            </div>
            <table>
              <tr>
                <th class="qty">Qty</th>
                <th class="item">Item</th>
                <th class="price">Price</th>
              </tr>
              ${order.items
                .map(
                  (item) => `
                <tr>
                  <td class="qty">${item.quantity}</td>
                  <td class="item">${item.name.slice(0, 20)}</td>
                  <td class="price">₹${item.price.toFixed(2)}</td>
                </tr>
              `
                )
                .join('')}
            </table>
            <div class="total">Total: ₹${order.total.toFixed(2)}</div>
            ${
              order.items.some((item) => item.specialInstructions)
                ? `
              <div class="instructions">
                Instructions:<br>
                ${order.items
                  .filter((item) => item.specialInstructions)
                  .map((item) => `- ${item.specialInstructions.slice(0, 30)}`)
                  .join('<br>')}
              </div>
            `
                : ''
            }
            <div class="divider"></div>
          </div>
        </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(receiptContent);
    printWindow.document.close();
    printWindow.print();
    printWindow.close();
  };

  const handlePrintCustomerReceipt = async () => {
  if (!selectedTable) {
    toast.error('Please select a table');
    return;
  }

  const tableOrders = recurringOrders.filter((order) => order.tableNo === parseInt(selectedTable));
  if (tableOrders.length === 0) {
    toast.error('No orders for selected table');
    return;
  }

  const allItems = tableOrders.flatMap((order) => order.items);
  const groupedItems = allItems.reduce((acc, item) => {
    const existingItem = acc.find((i) => i.name === item.name && i.price === item.price);
    if (existingItem) {
      existingItem.quantity += item.quantity;
    } else {
      acc.push({ ...item });
    }
    return acc;
  }, []);

  const subtotal = groupedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountAmount = subtotal * (parseFloat(discount || 0) / 100);
  const discountedTotal = subtotal - discountAmount;
  const gstAmount = discountedTotal * (parseFloat(gst || 0) / 100);
  const grandTotal = discountedTotal + gstAmount;

  const receiptContent = `
    <html>
      <head>
        <style>
          body {
            font-family: 'Courier New', monospace;
            font-size: 10px;
            width: 80mm;
            margin: 0;
            padding: 5mm;
            line-height: 1.4;
          }
          .receipt-container {
            border: 1px solid #000;
            padding: 5px;
          }
          .header {
            text-align: center;
            font-weight: bold;
            font-size: 12px;
            margin-bottom: 5px;
          }
          .details, .footer {
            margin: 5px 0;
          }
          .details p {
            margin: 2px 0;
            word-wrap: break-word;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 5px 0;
          }
          th, td {
            border: 1px solid #000;
            padding: 3px;
            text-align: left;
          }
          th {
            background-color: #eee;
          }
          .qty { width: 15%; }
          .item { width: 40%; }
          .price { width: 25%; text-align: right; }
          .amount { width: 20%; text-align: right; }
          .total-table td {
            text-align: right;
          }
          .total-table .label { text-align: left; }
          .message {
            text-align: center;
            font-style: italic;
            margin-top: 5px;
          }
          .divider {
            border-top: 1px dashed #000;
            margin: 5px 0;
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <div class="header">${restaurantDetails.name.slice(0, 32)}</div>
          <div class="details">
            <p>Address: ${restaurantDetails.address.slice(0, 64)}</p>
            <p>Phone: ${restaurantDetails.phoneNumber}</p>
            <p>GST: ${restaurantDetails.gst}</p>
            <p>FSSAI: ${restaurantDetails.fssai}</p>
          </div>
          <div class="divider"></div>
          <div class="details">
            <p>Table No: ${selectedTable}</p>
            <p>Date: ${new Date().toLocaleString()}</p>
          </div>
          <table>
            <tr>
              <th class="qty">Qty</th>
              <th class="item">Item</th>
              <th class="price">Price</th>
              <th class="amount">Amount</th>
            </tr>
            ${groupedItems
              .map(
                (item) => `
              <tr>
                <td class="qty">${item.quantity}</td>
                <td class="item">${item.name.slice(0, 15)}</td>
                <td class="price">₹${item.price.toFixed(2)}</td>
                <td class="amount">₹${(item.price * item.quantity).toFixed(2)}</td>
              </tr>
            `
              )
              .join('')}
          </table>
          <table class="total-table">
            <tr>
              <td class="label">Subtotal:</td>
              <td>₹${subtotal.toFixed(2)}</td>
            </tr>
            ${discount ? `
            <tr>
              <td class="label">Discount (${discount}%):</td>
              <td>-₹${discountAmount.toFixed(2)}</td>
            </tr>
            ` : ''}
            <tr>
              <td class="label">Taxable Amount:</td>
              <td>₹${discountedTotal.toFixed(2)}</td>
            </tr>
            ${gst ? `
            <tr>
              <td class="label">GST (${gst}%):</td>
              <td>₹${gstAmount.toFixed(2)}</td>
            </tr>
            ` : ''}
            <tr>
              <td class="label">Grand Total:</td>
              <td>₹${grandTotal.toFixed(2)}</td>
            </tr>
          </table>
          <div class="divider"></div>
          ${message ? `<div class="message">${message.slice(0, 32)}</div>` : ''}
          <div class="footer">
            <p style="text-align: center;">Thank You! Visit Again!</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  printWindow.document.write(receiptContent);
  printWindow.document.close();
  printWindow.print();
  printWindow.close();

  try {
    await Promise.all(
      tableOrders.map(async (order) => {
        const res = await axios.put(
          `${process.env.REACT_APP_API_URL}/orders/${order.id}/complete`,
          {},
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
        );
        setRecurringOrders(recurringOrders.filter((o) => o.id !== order.id));
        setPastOrders([...pastOrders, res.data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      })
    );
  } catch (error) {
    toast.error('Failed to complete order');
  }

  setSelectedTable('');
  setGst('');
  setDiscount('');
  setMessage('');
  window.location.reload();
};

  const uniqueTables = [...new Set(recurringOrders.map((order) => order.tableNo))];

  const filteredPastOrders = pastOrderDateFilter
    ? pastOrders.filter((order) =>
        new Date(order.createdAt).toISOString().slice(0, 10) === pastOrderDateFilter
      )
    : pastOrders;

  const handleShowMore = () => {
    setVisiblePastOrders((prev) => prev + 50);
  };

  return (
    <div className="orders-container">
      <Sidebar />
      <div className="orders-content">
        {loading && <LoadingSpinner />}
        <h2>Orders</h2>
        <OrderTable
          title="Live Orders"
          orders={liveOrders}
          onComplete={handleComplete}
          onDelete={handleDelete}
          onPrintKitchenReceipt={handlePrintKitchenReceipt}
        />

        <div className="recurring-receipt-container">
          <div className="recurring-orders">
            <OrderTable title="Recurring Orders" orders={recurringOrders} onDelete={handleDelete} />
          </div>

          <div className="receipt-printing">
            <h3>Customer Receipt Printing</h3>
            <div className="receipt-form">
              <select value={selectedTable} onChange={(e) => setSelectedTable(e.target.value)}>
                <option value="">Select Table</option>
                {uniqueTables.map((tableNo) => (
                  <option key={tableNo} value={tableNo}>Table {tableNo}</option>
                ))}
              </select>
              <input
                type="number"
                placeholder="GST %"
                value={gst}
                onChange={(e) => setGst(e.target.value)}
                min="0"
              />
              <input
                type="number"
                placeholder="Discount %"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                min="0"
              />
              <textarea
                placeholder="Message for receipt"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <button onClick={handlePrintCustomerReceipt}>Print Receipt</button>
            </div>
          </div>
        </div>

        <div className="past-orders-container">
          <div className="past-orders-header">
            <h3>Past Orders</h3>
            <div className="date-filter-container">
              <label htmlFor="past-order-date-filter">Filter by Date:</label>
              <input
                id="past-order-date-filter"
                type="date"
                value={pastOrderDateFilter}
                onChange={(e) => setPastOrderDateFilter(e.target.value)}
              />
            </div>
          </div>
          <OrderTable
            title=""
            orders={filteredPastOrders.slice(0, visiblePastOrders)}
            onDelete={handleDelete}
            onMoveToRecurring={handleMoveToRecurring}
          />
          {filteredPastOrders.length > visiblePastOrders && (
            <button className="see-more-button" onClick={handleShowMore}>
              See More
            </button>
          )}
        </div>
        <footer className="page-footer">Powered by SAE. All rights reserved.</footer>
      </div>
    </div>
  );
};

export default Orders;