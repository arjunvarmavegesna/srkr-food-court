'use strict';

const {
  getSession, setSession, resetSession,
  addToCart, removeFromCart, clearCart, getCart, getCartTotal,
  createOrder, getLatestOrderByPhone,
} = require('../services/orderStore');

const {
  getCategories, getItemsByCategory,
  getItemByCategoryAndNumber, formatCategoryMessage,
  formatCategoryItemsMessage,
} = require('../services/menuService');

const { sendMessage }       = require('../services/twilioService');
const { createPaymentLink } = require('../services/razorpayService');
const config                = require('../config');

const GREETINGS = ['HI','HELLO','HEY','MENU','START','HELO','HAI',
                   'NAMASTE','VANAKKAM','GOOD MORNING','GOOD EVENING',
                   'GOOD AFTERNOON','GOOD NIGHT','YO','SUP','HELP'];

function formatCart(cart) {
  if (!cart.length) return '🛒 Your cart is empty.';
  const lines = ['🛒 *Your Cart:*\n'];
  cart.forEach((c, i) => {
    const e = c.type === 'Veg' ? '🥦' : '🍗';
    lines.push(`${i + 1}. ${e} ${c.name} x${c.qty} – ₹${c.price * c.qty}`);
  });
  lines.push('\n💰 *Total: ₹' + cart.reduce((s, c) => s + c.price * c.qty, 0) + '*');
  return lines.join('\n');
}

function formatCartActions() {
  return (
    '\nWhat would you like to do?\n\n' +
    '➕ Reply a *category number* to add more items\n' +
    '🗑 Type *REMOVE* to remove an item\n' +
    '✅ Type *CHECKOUT* to place your order\n' +
    '🔄 Type *CLEAR* to empty your cart\n' +
    '📋 Type *CATEGORIES* to browse menu'
  );
}

function isCheckout(upper, normalized) {
  return upper === 'CHECKOUT' || upper === 'CONFIRM' || upper === 'CHECK OUT' ||
         upper === 'PAY' || upper === 'PLACE ORDER' || upper === 'ORDER' ||
         upper === 'DONE' || upper === 'PROCEED' || normalized === 'CHECKOUT' ||
         normalized === 'CONFIRM';
}

async function handleIncomingMessage(req, res) {
  res.sendStatus(200);

  const from  = req.body.From;
  const body  = (req.body.Body || '').trim();
  const upper = body.toUpperCase();
  const normalized = upper.replace(/\s+/g, '');

  if (!from || !body) return;

  console.log('📥 [' + from + '] "' + body + '"');

  const session = getSession(from);
  console.log('📊 step=' + session.step + ' cart=' + (session.cart || []).length + ' items');

  try {

    // STATUS
    if (upper === 'STATUS' || upper === 'MY ORDER' || normalized === 'STATUS') {
      await handleStatus(from);
      return;
    }

    // CART
    if (upper === 'CART' || normalized === 'CART') {
      const cart = getCart(from);
      if (!cart.length) {
        await sendMessage(from, '🛒 Your cart is empty.\n\nType *MENU* to browse our menu!');
      } else {
        await sendMessage(from, formatCart(cart) + formatCartActions());
      }
      return;
    }

    // CLEAR
    if (upper === 'CLEAR' || normalized === 'CLEAR') {
      clearCart(from);
      setSession(from, { step: 'AWAITING_CATEGORY' });
      await sendMessage(from, '🗑️ Cart cleared!\n\n' + await formatCategoryMessage());
      return;
    }

    // REMOVE
    if (upper === 'REMOVE' || normalized === 'REMOVE') {
      const cart = getCart(from);
      if (!cart.length) {
        await sendMessage(from, '🛒 Your cart is already empty.');
        return;
      }
      const lines = ['Which item do you want to remove?\n'];
      cart.forEach((c, i) => {
        lines.push((i + 1) + '. ' + c.name + ' x' + c.qty + ' – ₹' + (c.price * c.qty));
      });
      lines.push('\n_Reply with the number to remove_');
      setSession(from, { step: 'AWAITING_REMOVE' });
      await sendMessage(from, lines.join('\n'));
      return;
    }

    // BACK / CATEGORIES
    if (upper === 'BACK' || upper === 'CATEGORIES' || normalized === 'BACK' || normalized === 'CATEGORIES') {
      setSession(from, { step: 'AWAITING_CATEGORY', selectedCategory: null });
      const cart = getCart(from);
      let msg = await formatCategoryMessage();
      if (cart.length) {
        msg += '\n\n🛒 *Cart: ' + cart.length + ' item(s) — ₹' + getCartTotal(from) + '*\nType *CART* to view or *CHECKOUT* to pay';
      }
      await sendMessage(from, msg);
      return;
    }

    // CHECKOUT
    if (isCheckout(upper, normalized)) {
      await handleCheckout(from);
      return;
    }

    // Greetings / MENU
    if (GREETINGS.includes(upper) || session.step === 'WELCOME') {
      resetSession(from);
      await sendMessage(from,
        '🍽️ *Welcome to ' + config.restaurant.name + '!*\n\n' +
        'We are delighted to have you here. 😊\n' +
        'Pick a category to start adding items to your cart!'
      );
      await sendMessage(from, await formatCategoryMessage());
      setSession(from, { step: 'AWAITING_CATEGORY' });
      return;
    }

    // Number input
    if (/^\d+$/.test(body)) {

      if (session.step === 'AWAITING_REMOVE') {
        await handleRemoveItem(from, body);
        return;
      }

      if (session.step === 'AWAITING_CATEGORY') {
        await handleCategorySelection(from, body);
        return;
      }

      if (session.step === 'AWAITING_ITEM') {
        await handleItemSelection(from, body, session);
        return;
      }

      if (session.step === 'AWAITING_PAYMENT') {
        const order = await getLatestOrderByPhone(from);
        if (order && order.paymentStatus === 'PENDING') {
          await sendMessage(from,
            '⏳ You have a pending payment.\n\n' +
            '👉 Complete payment: ' + order.paymentLinkUrl + '\n\n' +
            '_Type *STATUS* to check or *MENU* to start a new order_'
          );
        } else {
          resetSession(from);
          await sendMessage(from, await formatCategoryMessage());
          setSession(from, { step: 'AWAITING_CATEGORY' });
        }
        return;
      }

      await handleCategorySelection(from, body);
      return;
    }

    // Context hints
    if (session.step === 'AWAITING_CATEGORY') {
      await sendMessage(from,
        '😊 Reply with a *category number* to browse items.\n\nType *MENU* to see categories again.'
      );
      return;
    }

    if (session.step === 'AWAITING_ITEM') {
      const cart = getCart(from);
      await sendMessage(from,
        '😊 Reply with an *item number* to add it to your cart.\n\n' +
        'Type *BACK* to go back to categories.\n' +
        (cart.length ? 'Type *CART* to view your cart (' + cart.length + ' items).' : '')
      );
      return;
    }

    // Final fallback
    resetSession(from);
    await sendMessage(from, '🍽️ *Welcome to ' + config.restaurant.name + '!*\n\nHere are our categories:');
    await sendMessage(from, await formatCategoryMessage());
    setSession(from, { step: 'AWAITING_CATEGORY' });

  } catch (err) {
    console.error('❌ [' + from + ']', err.message, err.stack);
    await sendMessage(from, '⚠️ Something went wrong. Type *MENU* to restart.').catch(() => {});
  }
}

async function handleCategorySelection(from, number) {
  const cats = await getCategories();
  const idx  = parseInt(number, 10);

  if (isNaN(idx) || idx < 1 || idx > cats.length) {
    await sendMessage(from,
      '❌ Please reply with a number between *1 and ' + cats.length + '*.\n\nType *MENU* to see categories.'
    );
    return;
  }

  const category = cats[idx - 1];
  setSession(from, { step: 'AWAITING_ITEM', selectedCategory: category });

  const cart = getCart(from);
  let msg = await formatCategoryItemsMessage(category);
  if (cart.length) {
    msg += '\n\n🛒 *Cart: ' + cart.length + ' item(s) — ₹' + getCartTotal(from) + '*';
  }
  await sendMessage(from, msg);
}

async function handleItemSelection(from, number, session) {
  const category = session.selectedCategory;

  if (!category) {
    setSession(from, { step: 'AWAITING_CATEGORY' });
    await sendMessage(from, await formatCategoryMessage());
    return;
  }

  const item  = await getItemByCategoryAndNumber(category, number);
  const items = await getItemsByCategory(category);

  if (!item) {
    await sendMessage(from,
      '❌ Please reply with a number between *1 and ' + items.length + '*.\n\nType *BACK* for categories.'
    );
    return;
  }

  const cart      = addToCart(from, item);
  const total     = getCartTotal(from);
  const typeEmoji = item.type === 'Veg' ? '🥦' : '🍗';
  const cartItem  = cart.find(c => c.id === item.id);

  await sendMessage(from,
    '✅ *Added to cart!*\n\n' +
    typeEmoji + ' *' + item.name + '* x' + cartItem.qty + ' – ₹' + (item.price * cartItem.qty) + '\n\n' +
    '🛒 Cart: *' + cart.length + ' item(s) — ₹' + total + '*\n\n' +
    'What next?\n' +
    '• Reply a *number* to add another item from *' + category + '*\n' +
    '• Type *BACK* to browse other categories\n' +
    '• Type *CART* to view your full cart\n' +
    '• Type *CHECKOUT* to place your order ✅'
  );
}

async function handleRemoveItem(from, number) {
  const cart = getCart(from);
  const idx  = parseInt(number, 10);

  if (isNaN(idx) || idx < 1 || idx > cart.length) {
    await sendMessage(from, '❌ Invalid number. Reply with 1 to ' + cart.length + '.');
    return;
  }

  const item    = cart[idx - 1];
  const newCart = removeFromCart(from, item.id);

  if (!newCart.length) {
    setSession(from, { step: 'AWAITING_CATEGORY' });
    await sendMessage(from,
      '🗑️ *' + item.name + '* removed.\n\nYour cart is now empty.\n\n' + await formatCategoryMessage()
    );
  } else {
    setSession(from, { step: 'AWAITING_CATEGORY' });
    await sendMessage(from,
      '🗑️ *' + item.name + '* removed.\n\n' + formatCart(newCart) + formatCartActions()
    );
  }
}

async function handleCheckout(from) {
  const cart  = getCart(from);
  const total = getCartTotal(from);

  if (!cart.length) {
    await sendMessage(from,
      '🛒 Your cart is empty!\n\nType *MENU* to browse our menu and add items.'
    );
    return;
  }

  await sendMessage(from, formatCart(cart) + '\n\n⏳ Generating your payment link...');

  let paymentLinkId, paymentLinkUrl;
  try {
    const result = await createPaymentLink({
      orderId: 'ORD-' + Date.now(),
      phone: from,
      cart,
      total,
    });
    paymentLinkId  = result.id;
    paymentLinkUrl = result.short_url;
  } catch (err) {
    console.error('❌ Razorpay error:', err.message);
    await sendMessage(from,
      '❌ Failed to generate payment link. Please try again.\n\nType *CHECKOUT* to retry.'
    );
    return;
  }

  const order = await createOrder({ phone: from, cart, paymentLinkId, paymentLinkUrl });
  clearCart(from);
  setSession(from, { step: 'AWAITING_PAYMENT', orderId: order.id });

  await sendMessage(from,
    '💳 *Payment Link Ready!*\n\n' +
    'Please pay *₹' + total + '* using the secure link below:\n\n' +
    '👉 ' + paymentLinkUrl + '\n\n' +
    '✅ Your order will be confirmed automatically once payment is received.\n\n' +
    '_Type *STATUS* anytime to check your payment_\n\n' +
    'Thank you for choosing *' + config.restaurant.name + '* 🙏'
  );
}

async function handleStatus(from) {
  const order = await getLatestOrderByPhone(from);

  if (!order) {
    await sendMessage(from,
      '📋 *Order Status*\n\nYou have not placed any orders yet.\n\nType *MENU* to browse our menu! 🍽️'
    );
    return;
  }

  const date = new Date(order.createdAt).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  const items = order.items || (order.item ? [Object.assign({}, order.item, { qty: 1 })] : []);
  const total = order.total || items.reduce((s, i) => s + i.price * (i.qty || 1), 0);

  const itemLines = items.map(function(i) {
    const e = i.type === 'Veg' ? '🥦' : '🍗';
    return '  ' + e + ' ' + i.name + ' x' + (i.qty || 1) + ' – ₹' + (i.price * (i.qty || 1));
  }).join('\n');

  let statusEmoji, statusLine, nextStep;
  if (order.paymentStatus === 'PAID') {
    statusEmoji = '✅';
    statusLine  = '*PAID* — Order Confirmed';
    nextStep    = '\nYour food is being prepared! 🍳\n\n_Type *MENU* to order again_';
  } else if (order.paymentStatus === 'FAILED') {
    statusEmoji = '❌';
    statusLine  = '*FAILED* — Payment unsuccessful';
    nextStep    = '\n_Type *MENU* to try again_';
  } else {
    statusEmoji = '⏳';
    statusLine  = '*PENDING* — Awaiting payment';
    nextStep    = '\n👉 Complete payment: ' + order.paymentLinkUrl + '\n\n_Tap the link to pay_';
  }

  await sendMessage(from,
    statusEmoji + ' *Order Status*\n\n' +
    '📦 *Items:*\n' + itemLines + '\n\n' +
    '💰 Total: ₹' + total + '\n' +
    '📅 Ordered: ' + date + '\n' +
    '🔖 Status: ' + statusLine +
    nextStep
  );
}

module.exports = { handleIncomingMessage };
