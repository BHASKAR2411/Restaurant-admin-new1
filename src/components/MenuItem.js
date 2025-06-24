import React from 'react';
import '../styles/MenuItem.css';

const MenuItem = ({ item, isSelected, onSelect, onIncrement, onDecrement, quantity, isEnabled }) => {
  return (
    <li className={`menu-item ${!isEnabled ? 'disabled-item' : ''}`}>
      {item.image && <img src={item.image} alt={item.name} className="menu-item-image" />}
      <h3>{item.name}</h3>
      <p className="price">₹{item.price?.toFixed(2) || '0.00'}</p>
      <p className="veg-status">{item.isVeg ? 'Veg' : 'Non-Veg'}</p>
      {!isEnabled ? (
        <p className="unavailable">Unavailable</p>
      ) : isSelected ? (
        <div className="controls">
          <button onClick={onDecrement} className="control-button">-</button>
          <span className="quantity">{quantity}</span>
          <button onClick={onIncrement} className="control-button">+</button>
        </div>
      ) : (
        <button onClick={() => onSelect(item)} className="add-button">Add to Order</button>
      )}
    </li>
  );
};

export default MenuItem;